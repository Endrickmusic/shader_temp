import { OrbitControls, useTexture } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useRef, useMemo } from "react"

import vertexShader from "./shader/vertexShader.js"
import fragmentShader from "./shader/fragmentShader.js"
import { DoubleSide, Vector2 } from "three"


export default function Shader(){

    const meshRef = useRef();

    const texture01 = useTexture("./textures/clouds_02.jpg")
    const viewport = useThree(state => state.viewport)

    useFrame((state) => {
      let time = state.clock.getElapsedTime()
  
      // start from 20 to skip first 20 seconds ( optional )
      meshRef.current.material.uniforms.uTime.value = time
    
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
            value: new Vector2(viewport.width, viewport.height),
            },
          texture01: {
            type: "t",
            value: texture01,
            },
          }),[viewport.width, viewport.height, texture01]
      )   

  return (
    <>
      <OrbitControls />    
      <mesh 
      ref={meshRef}
      scale={[viewport.width, viewport.height, 1]}
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
