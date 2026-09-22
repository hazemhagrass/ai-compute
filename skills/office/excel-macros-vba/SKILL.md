---
name: excel-macros-vba
description: Use when writing or fixing an Excel macro. Kill Select/Activate, batch I/O arrays, restore app state, keep .xlsm trusted.
---

Write macros that a second person can run on a different machine without the workbook opening to the wrong sheet, without a half-finished run leaving calculation set to Manual, and without a silent `On Error Resume Next` hiding the reason the numbers are wrong. The dominant VBA failure is not a crash: it is a procedure that completed, reported nothing, and left the workbook in a state nobody can reproduce.

## The working loop

1. **Record once to learn the object model**, then delete the recording. Recorded code is a starting reference, never shipped code.
2. **Rewrite it with explicit object references**: no `Selection`, no `ActiveSheet`, no `Select`.
3. **Wrap it**: `Option Explicit` at the top of the module, a state-saving prologue, an error handler, a cleanup label that always runs.
4. **Step through with F8** while watching the Locals and Immediate windows. Read the values, not the flow.
5. **Run it twice on the same data.** A macro that is not idempotent, or that fails on the second run because a helper sheet already exists, is not finished.
6. **Save as `.xlsm`, sign it, and document the Trust Center requirement** for whoever opens it next.

## 1. Never Select, never Activate

The macro recorder emits `Select` before every operation because that is what a human does with a mouse. In code it is pure cost: it is slow, it depends on which sheet is visible, it moves the user's cursor, and it breaks the moment the workbook opens on a different sheet.

```vb
' Bad: recorder output, depends on what is active
Sheets("Data").Select
Range("A1").Select
Selection.Value = "Region"
Selection.Font.Bold = True

' Good: fully qualified, active sheet irrelevant
With ThisWorkbook.Worksheets("Data").Range("A1")
    .Value = "Region"
    .Font.Bold = True
End With
```

**Rules:**
- Qualify every `Range` and `Cells` call with its worksheet. A bare `Range("A1")` means "A1 on whatever sheet happens to be active", which is a bug waiting for a user to click elsewhere.
- Use `ThisWorkbook` for the workbook containing the code and `ActiveWorkbook` only when the target is genuinely whatever the user has in front of them. They are different objects and the difference surfaces when a second file is open.
- `Select` is legitimate in exactly one place: the final line that leaves the user's cursor somewhere sensible.
- Use `With` blocks to avoid re-resolving the same object, because each dotted resolution is a separate COM call.

Worksheets have two identifiers. The tab name (`Worksheets("Data")`) breaks when a user renames the tab; the CodeName (`Sheet1`, shown in the Properties window) does not and is visible only in the VBE.

```vb
' Fragile: a user renames the tab, the macro raises 9 Subscript out of range
ThisWorkbook.Worksheets("Data").Range("A1").Value = 1

' Robust: CodeName, unaffected by tab renames
Sheet1.Range("A1").Value = 1
```

## 2. Option Explicit is not optional

Without `Option Explicit`, a typo creates a new empty `Variant` instead of raising an error, and the procedure continues with an unintended blank.

```vb
Option Explicit

Dim totalAmount As Double
totalAmnt = 100          ' Without Option Explicit: silently creates a new variable
```

Set it permanently: VBE, Tools, Options, Editor tab, "Require Variable Declaration". That only affects modules created afterwards, so add the line by hand to existing modules.

Declare each variable with its own `As` clause. `Dim i, j As Long` makes `i` a `Variant`, not a `Long`.

```vb
Dim i As Long, j As Long    ' Good
Dim i, j As Long            ' Bad: i is a Variant
```

Use `Long` for row counters, never `Integer`. `Integer` overflows at 32,767 and a worksheet has 1,048,576 rows, so `Dim r As Integer` raises error 6 partway down a real dataset.

## 3. Cell-by-cell loops are the performance bug

Every read or write across the Excel object model is a cross-process call. Looping 50,000 cells means 50,000 of them. Reading the range into a `Variant` array once, working in memory, and writing back once turns minutes into milliseconds.

```vb
' Bad: 100,000 COM round trips
Dim r As Long
For r = 2 To 50000
    ws.Cells(r, 3).Value = ws.Cells(r, 1).Value * ws.Cells(r, 2).Value
Next r

' Good: two round trips total
Dim data As Variant, out As Variant, r As Long
data = ws.Range("A2:B50000").Value        ' 2-D array, 1-based, (row, column)
ReDim out(1 To UBound(data, 1), 1 To 1)
For r = 1 To UBound(data, 1)
    out(r, 1) = data(r, 1) * data(r, 2)
Next r
ws.Range("C2").Resize(UBound(out, 1), 1).Value = out
```

An array read from a range is always 1-based and two-dimensional, even for a single row or column, and it carries values only: no formats, no formulas. Use `.Formula` instead of `.Value` when formulas must survive the round trip.

**Rules:**
- Read once, compute in an array, write once. Anything else is a rewrite waiting to happen.
- Never use `Range.Find` or `WorksheetFunction.VLookup` inside a loop. Load the lookup table into a `Scripting.Dictionary` (or `Collection`) first, then hit it in O(1).
- Delete rows bottom-up (`For r = lastRow To 2 Step -1`) or, better, collect them into a `Union` range and delete once, because deleting top-down shifts the rows you have not visited yet and skips every second match.

## 4. Find the last row correctly

`UsedRange` and `xlCellTypeLastCell` both include formatted-but-empty cells and stay stale after deletions. The reliable form searches upward from the bottom of the sheet.

```vb
' Bad: stale after rows are cleared, counts formatting as data
lastRow = ws.UsedRange.Rows.Count

' Bad: stops at the first blank cell in the column
lastRow = ws.Range("A1").End(xlDown).Row

' Good: true last used row in column A
lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row

' Good: last row anywhere on the sheet, blanks in any single column tolerated
lastRow = ws.Cells.Find(What:="*", SearchOrder:=xlByRows, _
                        SearchDirection:=xlPrevious, LookIn:=xlFormulas).Row
```

`Find` raises error 91 on a genuinely empty sheet, so guard it. `Rows.Count` must come from the worksheet object, not the literal `65536`, or the code breaks on `.xls`-era files and wastes rows on modern ones.

## 5. Turn off the screen, restore it in cleanup

Screen updating, automatic calculation, and event handlers each multiply the cost of every write. Switching them off is standard; failing to switch them back on is the classic support ticket, because the user's Excel silently stays on Manual calculation for the rest of the day.

```vb
Sub ProcessOrders()
    Dim savedCalc As XlCalculation
    Dim savedEvents As Boolean, savedUpdating As Boolean

    savedCalc = Application.Calculation
    savedEvents = Application.EnableEvents
    savedUpdating = Application.ScreenUpdating

    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual
    Application.DisplayAlerts = False

    ' ... work ...

Cleanup:
    Application.Calculation = savedCalc
    Application.EnableEvents = savedEvents
    Application.ScreenUpdating = savedUpdating
    Application.DisplayAlerts = True
    If Err.Number <> 0 Then
        MsgBox "ProcessOrders failed: " & Err.Number & " " & Err.Description, vbCritical
    End If
End Sub
```

**Rules:**
- Save the previous value and restore it. Do not hard-code `xlCalculationAutomatic` on exit, because you will force Automatic on a user who deliberately chose Manual.
- Restore in the cleanup label, which runs on both the success path and the error path. Restoring on the last line of the happy path only is the same as not restoring.
- `EnableEvents = False` is required whenever the macro writes to a sheet that has a `Worksheet_Change` handler, or the handler re-enters and recurses.
- `DisplayAlerts = False` suppresses the "are you sure" prompts on delete and save. Turn it back on immediately, because it also suppresses warnings you want.

## 6. Error handling that says what broke

`On Error Resume Next` does not handle errors, it discards them. The procedure keeps running with wrong values and reports success.

```vb
' Bad: every failure downstream is invisible
On Error Resume Next
Set wb = Workbooks.Open(path)
wb.Worksheets("Data").Range("A1").Value = 1

' Good: narrow scope, immediate check, immediate restore
On Error Resume Next
Set wb = Workbooks.Open(path)
On Error GoTo 0
If wb Is Nothing Then
    MsgBox "Could not open " & path, vbExclamation
    Exit Sub
End If
```

**Rules:**
- Use `On Error Resume Next` only around a single statement whose failure you check on the very next line, then `On Error GoTo 0` to restore normal handling.
- Report `Err.Number`, `Err.Description`, and the procedure name. A message box saying "Error occurred" is worth nothing to the person who receives it.
- Capture `Err` properties into local variables before cleanup code runs, because any statement in the handler can reset `Err`.
- Use `Err.Raise vbObjectError + n, "ProcName", "message"` to signal a business-rule failure, so callers can distinguish it from a runtime fault.
- Never leave a bare `Resume Next` in shipped code to "make the crash go away". Fix the cause or fail loudly.

## 7. Objects, references, and cleanup

`Set` is required for every object assignment and omitting it raises error 91 at a confusing place.

```vb
Dim ws As Worksheet
Set ws = ThisWorkbook.Worksheets("Data")    ' Set required
Dim n As Long
n = ws.Rows.Count                            ' no Set for values
```

Early binding (`Dim dict As Scripting.Dictionary`, with a Tools, References entry) gives IntelliSense and compile-time checking. Late binding (`Dim dict As Object` + `CreateObject("Scripting.Dictionary")`) survives a machine that lacks the reference. Ship late binding for anything distributed; develop with early binding, then switch before release.

Objects you create outside Excel must be closed explicitly, because a leaked reference leaves an invisible EXCEL.EXE or a locked file:

```vb
On Error GoTo Cleanup
Set xlApp = CreateObject("Excel.Application")
' ...
Cleanup:
If Not wb Is Nothing Then wb.Close SaveChanges:=False
If Not xlApp Is Nothing Then xlApp.Quit
Set wb = Nothing
Set xlApp = Nothing
```

## 8. Events and what they cost

Workbook and worksheet event procedures live in the object's own module, never in a standard module, or they never fire.

```vb
' In the worksheet's module
Private Sub Worksheet_Change(ByVal Target As Range)
    If Intersect(Target, Me.Range("B2:B1000")) Is Nothing Then Exit Sub
    Application.EnableEvents = False
    On Error GoTo Cleanup
    Target.Offset(0, 1).Value = Now
Cleanup:
    Application.EnableEvents = True
End Sub
```

**Rules:**
- Exit early with `Intersect(...) Is Nothing` before doing anything, because `Worksheet_Change` fires for every edit on the sheet.
- Disable events before writing from inside an event handler, and re-enable in a cleanup label, or the handler triggers itself.
- `Target` can be a multi-cell range (a paste, a fill). Code that assumes `Target.Value` is scalar raises error 13 on the first paste.
- `Worksheet_Change` does not fire when a cell changes because a formula recalculated. Use `Worksheet_Calculate` for that.

## 9. Macro-enabled files, trust, and signing

A `.xlsx` file silently discards all VBA on save. Save macro workbooks as `.xlsm` (or `.xlsb` for large ones, `.xlam` for add-ins).

- Macros from the internet are blocked outright by Mark of the Web: the user sees a red banner, not the "Enable Content" button. The fix is on the user's side: file Properties, Unblock, or a Trusted Location.
- A **Trusted Location** (File, Options, Trust Center, Trust Center Settings) runs macros without prompting. Prefer it over telling users to lower the global macro setting.
- **Sign the project** with a code-signing certificate (VBE, Tools, Digital Signature) so the workbook can be trusted by publisher rather than by path. Self-signed certificates work only on the machine that created them.
- Never ask a user to enable "Trust access to the VBA project object model" unless the macro genuinely writes code at runtime. It is an attack surface.
- Password-protecting a VBA project is obfuscation, not security. It is trivially removed. Do not put credentials or keys in a module.

## 10. Debugging

- **F8** steps one line; **Shift+F8** steps over a call; **Ctrl+Shift+F8** steps out.
- **Breakpoint** (F9) on the first suspicious line, then inspect the **Locals window** for every variable's current value and type. A `Variant` where you expected a `Long` explains most type-mismatch errors.
- **Immediate window** (Ctrl+G): `?ws.Name`, `?lastRow`, or `Debug.Print` from code. `Debug.Print` output survives the run; `MsgBox` blocks it.
- **Watch window**: right-click a variable, Add Watch, and set "Break when value changes" to find what mutates a variable you did not expect to move.
- **Debug, Compile VBAProject** before every hand-off. It catches undeclared variables, type mismatches, and missing references across all modules without running anything.
- `Stop` in code is a breakpoint that survives saving. Remove them before shipping, because a `Stop` in a user's copy opens the VBE at them.

## Anti-patterns

- `.Select` / `.Activate` anywhere but the final cursor placement.
- `On Error Resume Next` at the top of a procedure.
- `Dim` without types, or `Integer` for anything that counts rows.
- Cell-by-cell loops over more than a few hundred cells.
- `Application.ScreenUpdating = True` written only on the happy path.
- `ActiveSheet` and `Selection` in a procedure called from a button, because the active sheet at click time is not guaranteed.
- Hard-coded file paths (`C:\Users\me\...`). Build them from `ThisWorkbook.Path` or ask with `Application.GetOpenFilename`.
- `SendKeys`. It types into whatever window has focus at that instant.
- `Application.Wait` or `DoEvents` loops used as synchronization.
- Business logic duplicated in both a worksheet formula and a macro, which drift apart within a week.
- One 400-line `Sub`. Split it into named procedures that each do one thing and can be run alone.

## When to use this skill

Use it when a macro behaves differently for a colleague than for its author, when a workbook is slow enough that users think it froze, when calculation or screen updating is left broken after a run, when an error message says nothing useful, or when an `.xlsm` has to be distributed to people who did not write it.

Skip it when the task is a one-off transform (record it, run it, delete it), and move out of VBA entirely when the job needs version control, tests, external APIs, or scheduled unattended runs. At that point use Python with `openpyxl` or `pandas`, or Office Scripts for Excel on the web.
