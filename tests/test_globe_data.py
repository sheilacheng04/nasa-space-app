"""Check date/provenance boundaries; never interpret browse colors as measurements."""
import datetime as dt
import json
import sys
import unittest
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from render_globe_frames import parse_domain,maturity_window

class GlobeDataTests(unittest.TestCase):
 def test_disjoint_domains_keep_gaps(self):
  self.assertEqual(parse_domain('2026-01-01/2026-01-03/P1D,2026-01-06/2026-01-10/P2D'),['2026-01-01','2026-01-02','2026-01-03','2026-01-06','2026-01-08','2026-01-10'])
 def test_unsupported_interval_does_not_invent_dates(self):
  for period in ['P0D','P1M','PT24H']:
   with self.assertRaises(ValueError):parse_domain('2026-01-01/2026-02-01/'+period)
 def test_overlapping_release_windows_remain_ambiguous(self):
  self.assertEqual(maturity_window('2026-10-22'),'PROVISIONAL / VALIDATED')
  self.assertEqual(maturity_window('2026-03-01'),'Unconfirmed release window')
 def test_saved_axis_matches_advertised_dates(self):
  manifest=json.loads((ROOT/'public/data/globe/manifest.json').read_text())
  for layer in manifest['layers'].values():
   advertised=set(parse_domain(layer['domain']))
   self.assertEqual(advertised,set(layer['advertisedDates']))
   self.assertEqual(layer['start'],min(advertised));self.assertEqual(layer['end'],max(advertised))
   self.assertEqual({f['date'] for f in layer['frames'] if f['status']!='no-data'},advertised)
   self.assertEqual(len(layer['frames']),(dt.date.fromisoformat(layer['end'])-dt.date.fromisoformat(layer['start'])).days+1)
 def test_mission_gap_preserves_partial_boundary_days(self):
  manifest=json.loads((ROOT/'public/data/globe/manifest.json').read_text())
  frames={f['date']:f for f in manifest['layers'][manifest['defaultLayer']]['frames']}
  for day in range(28,32):self.assertEqual(frames[f'2026-07-{day:02}']['status'],'no-data')
  for day in range(1,10):self.assertEqual(frames[f'2026-08-{day:02}']['status'],'no-data')
  for date in ['2026-07-27','2026-08-10']:self.assertNotEqual(frames[date]['status'],'no-data')
  self.assertTrue(any(f['status']=='ready' and '2026-01-20'<f['date']<'2026-06-17' for f in frames.values()))
 def test_every_saved_image_is_bounded_and_auditable(self):
  manifest=json.loads((ROOT/'public/data/globe/manifest.json').read_text())
  for layer in manifest['layers'].values():
   for f in layer['frames']:
    self.assertEqual(f['maturity'],'not available at pixel level')
    if f['status']!='ready':continue
    file=ROOT/'public'/f['image']
    self.assertLessEqual(file.stat().st_size,150000)
    self.assertEqual(f['parameters']['TIME'],f['date'])
    self.assertIn('TIME='+f['date'],f['sourceUrl'])
    self.assertTrue(f['retrievedAt'])
    with Image.open(file) as im:
     self.assertEqual(im.format,'WEBP');self.assertEqual(im.size,(f['width'],f['height']))
     self.assertLessEqual(im.width,1024);self.assertEqual(im.width,im.height*2)
     self.assertGreater(im.convert('RGBA').getchannel('A').getextrema()[1],0)
if __name__=='__main__':unittest.main()
