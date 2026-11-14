"""Scientific failure modes: nodata, independent agreement and provenance."""
import unittest,sys,json
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from science_products import water_mask,agreement
from fetch_context import monthly
from news_sentiment import merge
class Safeguards(unittest.TestCase):
 def test_nodata_never_becomes_dry_land_or_water(self):
  a=water_mask(np.array([-18.,-16.,np.nan,-20]),np.array([-25.,-30.,-25.,np.nan]))
  self.assertEqual(a[0],1);self.assertEqual(a[1],0);self.assertTrue(np.isnan(a[2:]).all())
 def test_independent_agreement_excludes_unknown_reference(self):
  result=agreement(np.array([1.,1.,0.,np.nan,0.]),np.array([1.,0.,1.,1.,np.nan]))
  self.assertEqual(result['nValidPixels'],3);self.assertAlmostEqual(result['agreement'],1/3);self.assertAlmostEqual(result['iou'],1/3)
  self.assertIsNone(agreement(np.array([np.nan]),np.array([1.]))['agreement'])
 def test_incomplete_month_does_not_become_low_rainfall(self):
  result=monthly([{'date':'2026-01-01','rain':0,'temperature':20}])[0]
  self.assertIsNone(result['rain']);self.assertIsNone(result['temperature']);self.assertFalse(result['complete'])
 def test_news_merge_preserves_review_and_ai(self):
  old={'url':'https://example.org/a/','date':'2026-09-01','title':'Original','ai':{'score':.3}}
  new={'url':'https://example.org/a','date':'2026-10-01','title':'Duplicate','ai':None}
  result=merge([old],[new]);self.assertEqual(len(result),1);self.assertEqual(result[0]['ai']['score'],.3)
 def test_catalog_pairs_match_maturity_frame_track_and_crid(self):
  inv=json.loads((Path(__file__).resolve().parents[1]/'public/data/inventory.json').read_text())
  for site in inv['sites']:
   pair=site.get('pair')
   if not pair:continue
   a=next(s for s in site['scenes'] if s['id']==pair['before']);b=next(s for s in site['scenes'] if s['id']==pair['after'])
   for k in ['maturity','track','frame','crid','direction']:self.assertEqual(a[k],b[k])
   self.assertEqual(a['maturity'],'PROVISIONAL');self.assertRegex(a['crid'],r'^P\d{5}$');self.assertLess(a['date'],b['date'])
if __name__=='__main__':unittest.main()
