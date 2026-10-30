# Home addition tracker

A web app for tracking the remodel and addition at 3315 S. Columbine Cir. (permit BLD-2024-01595). No build step, no server code: it's static HTML, CSS and JavaScript.

| Tab | What it does |
|---|---|
| Overview | Budget, projected cost, progress and projected finish at a glance, plus what's next and the latest log entries |
| 3D model | The bedroom wing, garage and existing house, traced from the Ready for Construction set. **Finished** shows the completed design; **Current progress** shows each part as a ghost, in progress, or done based on the schedule. Views: 3D, from the street, and plan |
| Budget | Budget vs. actual by category and line item, variance, projected cost, and an expense ledger |
| Schedule | Gantt chart. Click a task to set progress or record a delay; delays push that task and everything that depends on it. The gray line under each bar is the original plan, and red hatching is delay |
| Log | Dated notes with photos (issues, inspections, deliveries, delays, payments). Delays recorded on the schedule are logged automatically |
| Data | Export and import a backup, reset to the starting data, and edit project details |

## Hosted version

A private copy runs as a claude.ai Artifact. There, the budget, schedule and log are saved with the artifact (its shared database) and photos in its file store, so they're the same on every device. The page detects this automatically (`window.claude`) and uses the browser-only storage below otherwise.

## Run it locally

Any static file server works. From this folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly from disk won't work, because browsers block ES modules on `file://`.

To publish with GitHub Pages: Settings → Pages → deploy from branch, folder `/` on the branch you want, then open `/addition-tracker/`.

## Where data lives

- **Starting data:** `data/project-data.js`. The budget, schedule, model geometry and materials are all there, with comments. Budget and schedule figures are **placeholders** until the contractor's bid and schedule are in; set the `placeholder` flags to `false` when they're real.
- **Your changes:** saved in the browser (localStorage for data, IndexedDB for photos, downscaled to 1800 px). Use **Data → Export** for backups and to move to another device. Clearing site data in the browser deletes them.

## 3D model notes

Plan coordinates are in feet, +x east and +y north, with the origin at the north eave corner of the new wing. Walls are extruded from footprint polygons; roofs are hip roofs over rectangular eave outlines, and the wing's L-shaped roof is two overlapping hips (as on sheet A1.4). Heights come from the addition cross section: wing floor about 3' above grade with 10'-1" plates and a 7/12 roof, garage slab at grade with an 8'-1" plate. It's close but not survey-accurate.

three.js r160 is vendored in `vendor/three` (MIT license) so the app works offline.
