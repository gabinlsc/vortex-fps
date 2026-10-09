import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Batch only root-level, opaque static meshes. Animated groups and instancing retain ownership.
export function batchStatic(scene:THREE.Scene):void {
  const groups=new Map<string,THREE.Mesh[]>();scene.updateMatrixWorld(true);
  for(const object of scene.children){if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh||Array.isArray(object.material)||object.material.transparent||object.children.length)continue;
    const key=object.material.uuid+':'+object.castShadow+':'+object.receiveShadow+':'+Object.keys(object.geometry.attributes).sort().join(',');const list=groups.get(key)??[];list.push(object);groups.set(key,list);}
  for(const objects of groups.values()){if(objects.length<2)continue;const parts=objects.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);return g;});const g=mergeGeometries(parts);for(const p of parts)p.dispose();if(!g)continue;const result=new THREE.Mesh(g,objects[0].material);result.castShadow=objects[0].castShadow;result.receiveShadow=objects[0].receiveShadow;result.name='static-batch';scene.add(result);for(const o of objects)scene.remove(o);}
}
