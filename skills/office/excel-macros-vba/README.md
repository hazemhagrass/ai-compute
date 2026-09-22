# Excel Macros & VBA

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="excel-macros-vba robot" width="200">
</div>

A skill for writing VBA that survives a second machine: explicit object references instead of `Select`, array reads instead of cell loops, application state saved and restored in a cleanup label, errors that name themselves, and `.xlsm` distribution that actually runs on the recipient's Excel.

## What it does

Recorded macros work exactly once, on the author's screen, with the author's sheet active. This skill names each mechanism that breaks them and gives the replacement:

- **Select/Activate dependence**: why recorder output depends on the visible sheet, and the fully qualified `Worksheet.Range` form that does not. Includes CodeName vs tab name for rename-proof references.
- **Implicit declaration**: `Option Explicit`, per-variable `As` clauses, and why `Dim r As Integer` raises error 6 partway down a real dataset.
- **Cell-by-cell loops**: the cross-process cost of every `.Value` touch, and the read-array / compute / write-array pattern that replaces it.
- **Last-row detection**: why `UsedRange` and `End(xlDown)` both lie, and the `Cells(Rows.Count, "A").End(xlUp)` form that does not.
- **Application state**: saving `Calculation`, `EnableEvents`, and `ScreenUpdating`, then restoring them in a label that runs on the error path too.
- **Error handling**: the narrow, checked `On Error Resume Next` versus the blanket one that discards every failure downstream.
- **Object lifetime**: `Set`, early vs late binding, and closing external Excel instances so no orphan EXCEL.EXE is left running.
- **Events**: `Intersect` guards, event re-entrancy, multi-cell `Target`, and which module an event procedure must live in.
- **Trust and distribution**: `.xlsm` vs `.xlsx`, Mark of the Web blocking, Trusted Locations, code signing, and why VBA project passwords are not security.
- **Debugging**: F8 stepping, Locals and Watch windows, `Debug.Print`, and Compile VBAProject as a pre-hand-off gate.

## When to use this

Concrete triggers:

- A macro runs for the author and raises "Subscript out of range" or writes to the wrong sheet for everyone else.
- Someone renamed a worksheet tab and the macro stopped working.
- A routine takes minutes on 50,000 rows and users assume Excel has frozen.
- After a macro run, Excel is stuck on Manual calculation or the screen stays frozen.
- A row-deletion loop deletes every second matching row.
- An error message reads "Error occurred" with no number, description, or procedure name.
- `On Error Resume Next` sits on the first line of a procedure that reports success on bad data.
- A `Worksheet_Change` handler recurses, or raises error 13 the first time someone pastes a block.
- Macros vanished after a save, because the file was saved as `.xlsx`.
- A recipient sees a red security banner instead of the Enable Content button.
- An orphan EXCEL.EXE is left in Task Manager after automation runs.
- An `.xlsm` is about to be distributed to people who cannot read VBA.

Skip it when:

- The task is a one-off transform you will record, run once, and delete.
- The work needs version control, unit tests, external APIs, or scheduled unattended runs (use Python with `openpyxl`/`pandas`, or Office Scripts).
- The logic belongs in a worksheet formula, a Power Query step, or a PivotTable.

## Quick start

A complete, shippable procedure: read an order sheet, compute line totals against a price lookup, write results back, and leave the application exactly as found.

**Step 0: module header**

```vb
Option Explicit
```

**Step 1: save state and arm the handler before touching anything**

```vb
Sub BuildLineTotals()
    Dim savedCalc As XlCalculation
    Dim savedEvents As Boolean, savedUpdating As Boolean
    Dim ws As Worksheet, lastRow As Long
    Dim data As Variant, out As Variant, r As Long
    Dim prices As Object, key As String

    savedCalc = Application.Calculation
    savedEvents = Application.EnableEvents
    savedUpdating = Application.ScreenUpdating

    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual
```

**Step 2: resolve objects explicitly, find the real last row**

```vb
    Set ws = ThisWorkbook.Worksheets("Orders")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    If lastRow < 2 Then Err.Raise vbObjectError + 1, "BuildLineTotals", "No data rows found."
```

**Step 3: load the lookup into a dictionary, not into a loop of VLOOKUPs**

```vb
    Set prices = CreateObject("Scripting.Dictionary")   ' late binding: no reference needed
    prices.CompareMode = 1                              ' vbTextCompare
    Dim pw As Worksheet, pLast As Long, p As Long, pdata As Variant
    Set pw = ThisWorkbook.Worksheets("Products")
    pLast = pw.Cells(pw.Rows.Count, "A").End(xlUp).Row
    pdata = pw.Range("A2:B" & pLast).Value
    For p = 1 To UBound(pdata, 1)
        prices(Trim$(CStr(pdata(p, 1)))) = pdata(p, 2)
    Next p
```

**Step 4: one read, in-memory compute, one write**

```vb
    data = ws.Range("A2:C" & lastRow).Value      ' SKU, Quantity, Discount
    ReDim out(1 To UBound(data, 1), 1 To 1)
    For r = 1 To UBound(data, 1)
        key = Trim$(CStr(data(r, 1)))
        If prices.Exists(key) Then
            out(r, 1) = Round(prices(key) * data(r, 2) * (1 - data(r, 3)), 2)
        Else
            out(r, 1) = "missing price"
        End If
    Next r
    ws.Range("D2").Resize(UBound(out, 1), 1).Value = out
```

**Step 5: report what failed instead of hiding it**

```vb
    Dim misses As Long
    misses = Application.WorksheetFunction.CountIf(ws.Range("D2:D" & lastRow), "missing price")
    If misses > 0 Then MsgBox misses & " rows had no price.", vbExclamation
```

**Step 6: cleanup runs on both paths**

```vb
Cleanup:
    Application.Calculation = savedCalc
    Application.EnableEvents = savedEvents
    Application.ScreenUpdating = savedUpdating
    If Err.Number <> 0 Then
        MsgBox "BuildLineTotals failed: " & Err.Number & " - " & Err.Description, vbCritical
    End If
End Sub
```

**Step 7: verify before hand-off**

Run Debug, Compile VBAProject. Step the procedure once with F8, watching the Locals window. Run it twice on the same data and confirm the second run produces identical output. Save as `.xlsm`, then open it on another machine and confirm it runs from a Trusted Location.

## Key concepts

- **Qualified reference.** `ThisWorkbook.Worksheets("Orders").Range("A1")` names its sheet and workbook. A bare `Range("A1")` means the active sheet, which the user controls.
- **ThisWorkbook vs ActiveWorkbook.** `ThisWorkbook` is the file containing the code; `ActiveWorkbook` is whatever is in front. They diverge the moment a second file is open.
- **CodeName.** The sheet's VBE identifier (`Sheet1`), separate from the tab name and unaffected by user renames.
- **Variant array round trip.** `arr = rng.Value` returns a 1-based two-dimensional array of values only, no formats or formulas. Writing back needs a target of matching size via `.Resize`.
- **State restoration.** `Calculation`, `EnableEvents`, `ScreenUpdating`, and `DisplayAlerts` are application-wide and persist after the macro ends. Save the prior values, restore them in a cleanup label.
- **Cleanup label.** A line label at the end of the procedure that both the success path and `On Error GoTo` reach, so teardown is unconditional.
- **Narrow Resume Next.** `On Error Resume Next` around one statement, a check on the next line, then `On Error GoTo 0`. Anything wider is error suppression.
- **Early vs late binding.** Early binding needs a Tools, References entry and gives IntelliSense and compile checks; late binding (`CreateObject`) has neither but runs on machines without the reference.
- **Event re-entrancy.** Writing to a sheet from inside `Worksheet_Change` retriggers it unless `EnableEvents` is `False` for the duration.
- **Macro-enabled format.** `.xlsm`, `.xlsb`, `.xlam` keep VBA; `.xlsx` discards it silently on save.
- **Mark of the Web.** Files from the internet or email are blocked from running macros regardless of Trust Center settings until unblocked or placed in a Trusted Location.

## Common pitfalls

**Recorder-style Select**

```vb
Sheets("Data").Select: Range("A1").Select: Selection.Value = 1   ' Bad
ThisWorkbook.Worksheets("Data").Range("A1").Value = 1            ' Good
```

Reason: the recorded form works only while that sheet is active and moves the user's cursor every run.

**Unqualified Range**

```vb
Range("A1").Value = "Total"                    ' Bad
ws.Range("A1").Value = "Total"                 ' Good
```

Reason: an unqualified `Range` targets the active sheet, so the macro writes wherever the user last clicked.

**Integer row counter**

```vb
Dim r As Integer    ' Bad: overflow error 6 at row 32,768
Dim r As Long       ' Good
```

Reason: worksheets hold 1,048,576 rows and `Integer` caps at 32,767.

**Multi-variable Dim**

```vb
Dim i, j As Long      ' Bad: i is a Variant
Dim i As Long, j As Long   ' Good
```

Reason: VBA applies `As` only to the variable it directly follows.

**Cell-by-cell loop**

```vb
For r = 2 To 50000: ws.Cells(r, 3).Value = ws.Cells(r, 1).Value * 2: Next r   ' Bad
data = ws.Range("A2:A50000").Value  ' compute in array, write once             ' Good
```

Reason: each `.Value` touch is a separate cross-process call; the array form does two.

**UsedRange for the last row**

```vb
lastRow = ws.UsedRange.Rows.Count                          ' Bad
lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row       ' Good
```

Reason: `UsedRange` counts formatted-but-empty cells and stays stale after deletions.

**Top-down row deletion**

```vb
For r = 2 To lastRow: If ... Then ws.Rows(r).Delete        ' Bad
For r = lastRow To 2 Step -1: If ... Then ws.Rows(r).Delete ' Good
```

Reason: deleting shifts the remaining rows up, so the loop skips the row that moved into the deleted index.

**Blanket error suppression**

```vb
On Error Resume Next        ' Bad, at the top of the procedure
On Error GoTo Cleanup       ' Good
```

Reason: `Resume Next` discards the error and lets the procedure finish with wrong values and no warning.

**ScreenUpdating restored only on success**

```vb
' Bad: last line of the happy path
Application.ScreenUpdating = True

' Good: in the cleanup label reached by both paths
Cleanup:
    Application.ScreenUpdating = savedUpdating
```

Reason: an error leaves the user's Excel frozen and on Manual calculation for the rest of the session.

**Hard-coded calculation restore**

```vb
Application.Calculation = xlCalculationAutomatic   ' Bad
Application.Calculation = savedCalc                ' Good
```

Reason: it overrides a user who deliberately chose Manual on a heavy workbook.

**Event handler without an Intersect guard**

```vb
Private Sub Worksheet_Change(ByVal Target As Range)
    Target.Offset(0, 1).Value = Now                ' Bad: fires on every edit, recurses
```

```vb
    If Intersect(Target, Me.Range("B2:B1000")) Is Nothing Then Exit Sub
    Application.EnableEvents = False                ' Good
```

Reason: `Worksheet_Change` fires for every cell edit on the sheet, and writing from inside it retriggers itself.

**Scalar assumption about Target**

```vb
If Target.Value = "" Then      ' Bad: error 13 on a pasted block
If Target.Cells.Count > 1 Then Exit Sub   ' Good, or loop over Target.Cells
```

Reason: a paste or fill delivers a multi-cell `Target`.

**Missing Set**

```vb
ws = ThisWorkbook.Worksheets("Data")       ' Bad: error 91 later
Set ws = ThisWorkbook.Worksheets("Data")   ' Good
```

Reason: object assignment requires `Set`; without it VBA attempts a default-property assignment.

**Leaked Excel instance**

```vb
Set xlApp = CreateObject("Excel.Application")   ' Bad without a Quit in cleanup
' Good: xlApp.Quit and Set xlApp = Nothing in the cleanup label
```

Reason: the orphan process holds the file lock and is invisible except in Task Manager.

## See also

- `SKILL.md` in this directory: the full rule set with paired examples across all ten areas.
- Microsoft docs: "Getting started with VBA in Office", the Excel VBA object model reference, and the `Application.ScreenUpdating` / `Application.Calculation` pages.
- Microsoft docs: "Enable or disable macros in Office files", Trusted Locations, and digitally signing a VBA project.
- VBE tooling: Debug, Compile VBAProject; the Locals, Watch, and Immediate windows; F8 stepping.
- `skills/office/excel-formulas`: when the logic belongs in a formula rather than a macro.
- `skills/office/excel-data-cleaning`: when the macro exists only to reshape a messy import.
- `skills/data/python-pandas-analysis`: when the job needs tests, version control, or unattended scheduling.
