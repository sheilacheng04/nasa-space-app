# Sharing evidence views

Use **Copy link** on Sites or Globe. The app copies an HTTP(S) link to the current evidence view. If clipboard access fails, a selectable link appears for manual copying. Local offline-file links are not advertised as shareable across devices.

Selection parameters belong **inside the hash**, after the page route:

~~~text
#sites/angat?source=gibs&view=timeline&date=2026-11-02
#sites/angat?source=browse&channel=HV&view=swipe&before=2026-06-23&after=2026-10-09
#globe?mode=concept&site=dadu&date=2026-10-31&month=2026-09
~~~

## Sites

The path contains the study-site ID. Parameters select source (gibs, browse, processed or simulated), channel where supported, view (timeline, swipe or available change layer), and date or before/after dates. GIBS false-color mosaics are not an isolated HH/HV channel, so channel is omitted for that source. Copied regional comparison links retain full UTC acquisition timestamps when present; calendar-day links also work for the current saved sequences.

Missing or invalid parameters use supported defaults. An unavailable processed source falls back to labeled browse evidence; unsupported channels are explained. Valid requested dates absent from the selected source remain explicit unavailable entries, never a nearby or latest observation. Study-site changes start that site's default sequence; Back returns to the prior site's exact selections.

## Globe

mode=satellite selects radar; mode=concept selects Land through time. site selects a supported study area, date selects a radar mosaic day, and month selects a MODIS calendar month. Radar and vegetation retain independent selections across mode switches. Unavailable months and valid dates outside the saved archive remain selected with unavailable imagery. A missing saved image is not evidence that no mission acquisition occurred.

## Navigation and limits

Discrete selections add history entries. Scrubbers and playback replace the current entry, avoiding one Back step per animation frame. Back/Forward restores URL selections and pauses playback. Changing dates, channels or comparison controls does not reload the document or refetch the current site's evidence/weather JSON. Existing route aliases and page-section links remain supported.

Dialogs, playback state, speed, loading, hover, camera orientation, detailed-map controls, and imported/private observations are not encoded. Links select data in the current edition; they do not pin an immutable dataset version or transfer local observations. An offline file can restore selections on the same device, subject to its embedded image subset, but copying its local path does not distribute that file.
