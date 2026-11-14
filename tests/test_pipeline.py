import unittest,tempfile,sys,json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.transform import from_bounds
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import prepare_radar as p
class PipelineTests(unittest.TestCase):
 def test_log_power_and_nodata(self):
  got=p.power_db(np.array([1,.1,0,-1,np.nan],dtype='float32'));np.testing.assert_allclose(got[:2],[0,-10]);self.assertTrue(np.isnan(got[2:]).all())
 def test_paired_pixels_only(self):
  a=np.array([[1,2],[np.nan,4]],dtype='float32');b=np.array([[3,np.nan],[9,5]],dtype='float32');change,stats=p.paired_change(a,b);self.assertEqual(stats['validFraction'],.5);self.assertEqual(stats['meanDeltaDb'],1.5);self.assertTrue(np.isnan(change[0,1]))
 def test_gcov_reader_honors_available_bands_and_mask(self):
  import h5py
  with tempfile.TemporaryDirectory() as temp:
   file=Path(temp)/'scene.h5'
   with h5py.File(file,'w') as f:
    g=f.create_group('/science/LSAR/GCOV/grids/frequencyA');g['xCoordinates']=np.array([120.995,121.005]);g['yCoordinates']=np.array([15.005,14.995]);g['xCoordinateSpacing']=.01;g['yCoordinateSpacing']=-.01;g['projection']=4326;g['HHHH']=np.array([[1.,.1],[.2,.3]],dtype='float32');g['HHHH'].attrs['units']='1';g['rtcGammaToSigmaFactor']=np.ones((2,2));g['mask']=np.array([[0,1],[0,0]],dtype='uint8');g['numberOfLooks']=np.array([[1,1],[0,1]],dtype='float32')
   with self.assertRaises(ValueError):p.read_gcov(file,'A','HH',[120.99,14.99,121.01,15.01],[])
   data,transform,crs=p.read_gcov(file,'A','HH',[120.99,14.99,121.01,15.01],[0]);self.assertAlmostEqual(data[0,0],1);self.assertTrue(np.isnan(data[0,1]));self.assertTrue(np.isnan(data[1,0]));self.assertEqual(crs,'EPSG:4326');self.assertIsNone(p.read_gcov(file,'A','HV',[120.99,14.99,121.01,15.01],[0]))
 def test_end_to_end_rtc(self):
  previous=(p.ROOT,p.DATA)
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);p.ROOT=root;p.DATA=root/'public/data';p.DATA.mkdir(parents=True);(p.DATA/'observations').mkdir();site=dict(id='test',name='Test',coordinates=[121,15],bbox=[120.99,14.99,121.01,15.01]);(p.DATA/'sites.json').write_text(json.dumps([site]));entries=[]
   for i,value in enumerate([.1,.2]):
    file=root/f'scene{i}.tif';arr=np.full((100,100),value,dtype='float32');arr[:5,:]=np.nan
    with rasterio.open(file,'w',driver='GTiff',width=100,height=100,count=1,dtype='float32',crs='EPSG:4326',transform=from_bounds(*site['bbox'],100,100),nodata=np.nan) as dst:dst.write(arr,1)
    entries.append(dict(id=f'scene{i}',date=f'2026-10-{1+i*12:02d}',sensor='Sentinel-1 RTC',track='41',direction='ASCENDING',frequency='C',maturity='reviewed',processingVersion='test',sourceUrl='https://example.com/science',kind='rtc',units='linear_power',channels={'VV':file.name}))
   manifest=root/'manifest.json';manifest.write_text(json.dumps(dict(siteId='test',resolution_m=30,acquisitions=entries)));p.prepare(manifest);pkg=json.loads((p.DATA/'observations/test.json').read_text());self.assertEqual(pkg['status'],'ready');self.assertEqual(len(pkg['comparisons']),1);self.assertAlmostEqual(pkg['comparisons'][0]['meanDeltaDb'],3.0103,places=3)
   cog=root/'public'/pkg['acquisitions'][0]['channels']['VV']['cog']
   with rasterio.open(cog) as ds:self.assertEqual(ds.tags(ns='IMAGE_STRUCTURE').get('LAYOUT'),'COG');self.assertIsNotNone(ds.crs)
  p.ROOT,p.DATA=previous
if __name__=='__main__':unittest.main()
