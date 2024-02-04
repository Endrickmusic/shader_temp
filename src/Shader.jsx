import { OrbitControls, useAspect } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useRef, useMemo } from "react"

import vertexShader from "./shader/vertexShader.js"
import fragmentShader from "./shader/fragmentShader.js"
import { DoubleSide, Vector2 } from "three"


export default function Shader(){

    const meshRef = useRef();

    const size = useThree(state => state.size)
    const pointer = useThree(state => state.pointer)

    useFrame((state) => {
      let time = state.clock.getElapsedTime()      
      meshRef.current.material.uniforms.uTime.value = time
      meshRef.current.material.uniforms.uResolution.value = new Vector2(size.width, size.height)
      meshRef.current.material.uniforms.uMouse.value = new Vector2((pointer.x * size.width), (pointer.y * size.height))

      console.log(pointer)
    })
  
      // Define the shader uniforms with memoization to optimize performance
      const uniforms = useMemo(
        () => ({
          uTime: {
            type: "f",
            value: 1.0,
              },
          uResolution: {
            type: "v2",
            value: new Vector2(size.width, size.height),
            },
          uMouse: {
            type: "v2",
            value: new Vector2(pointer.x, pointer.y)
          }
         }),[size.width, size.height]
         
      )   

  return (
    <>
      <OrbitControls />    
      <mesh 
      ref={meshRef}
      scale={[size.width, size.height, 1]}
      >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            side={DoubleSide}
          />
        </mesh>
   </>
  )}
