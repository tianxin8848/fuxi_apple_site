import * as Globe from 'https://unpkg.com/globe.gl';

// 创建地球
const globe = Globe()(document.getElementById('globe'))
  .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png');

// 添加控制
globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.5;
