# 3dMapRender.js
Simple 3d map island render using three.js.

Based on the work done by lebesnec on the repository: https://github.com/lebesnec/island.js

Taken a island generated using a voronoi diagram and based on the paper renderer done by lebesnec, this is an implementation of a render in 3d using three.js

Features:
- Biomes
- River water flow direction information
- Rivers / lakes / marshes / ocean

Paper render with 50k sites and 512x512:
![alt text](https://raw.githubusercontent.com/alvaromongon/3dMapRender.js/master/Images/PaperRenderer_50000p_512s.png)


Three render with 50k sites and 512x512:
![alt text](https://raw.githubusercontent.com/alvaromongon/3dMapRender.js/master/Images/ThreeRenderer_50000p_512s.png)
