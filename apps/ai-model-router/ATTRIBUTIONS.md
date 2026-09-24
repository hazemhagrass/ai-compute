# Third-party attributions

## Hermes agent dashboard (MIT)

`src/components/DashboardPanel.tsx` is a Next.js port of the sortable-table
structure from the Hermes agent web dashboard (React + Vite), maintained by
Nous Research under the MIT License.

Upstream repository: hermes-agent (https://hermes-agent.nousresearch.com/docs)

The port covers UI patterns only:
 - the `useSort` / `SortHeader` sortable-table helper
 - the daily and per-bucket table layout on `pages/AnalyticsPage.tsx`

Nothing from the Hermes runtime, its API surface, or its database is
imported: the port reads the router's own `/api/analytics`. The upstream
dashboard continues to run at its own port unchanged.

```
MIT License

Copyright (c) 2025 Nous Research

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
