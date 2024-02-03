import { OrbitControls, useTexture, useFBO } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useRef, useMemo, useState } from "react"

import vertexShader from "./shader/vertexShader.js"
import fragmentShader from "./shader/fragmentShader.js"
import { DoubleSide, Vector2 } from "three"
import { MeshNormalMaterial, Scene } from "three"


export default function Shader(){

    const meshRef = useRef()
    const buffer = useFBO()
    // const texture01 = useTexture("./textures/clouds_02.jpg")
    const viewport = useThree(state => state.viewport)
    const scene = useThree(state => state.scene)

    useFrame((state) => {
      let time = state.clock.getElapsedTime()
  
      // start from 20 to skip first 20 seconds ( optional )
      meshRef.current.material.uniforms.uTime.value = time

      // Tie lens to the pointer
      // getCurrentViewport gives us the width & height that would fill the screen in threejs units
      // By giving it a target coordinate we can offset these bounds, for instance width/height for a plane that
      // sits 15 units from 0/0/0 towards the camera (which is where the lens is)
      const viewportFBO = state.viewport.getCurrentViewport(state.camera, [0, 0, 15])
    
      // This is entirely optional but spares us one extra render of the scene
      // The createPortal below will mount the children of <Lens> into the new THREE.Scene above
      // The following code will render that scene into a buffer, whose texture will then be fed into
      // a plane spanning the full screen and the lens transmission material
      state.gl.setRenderTarget(buffer)
      state.gl.setClearColor('#d8d7d7')
      state.gl.render(scene, state.camera)
      state.gl.setRenderTarget(null)
    
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
            value: buffer.texture,
            },
          }),[viewport.width, viewport.height, buffer.texture]
      )   

  return (
    <>
      <OrbitControls /> 
      <mesh
      position = {[0, 0.5, -4]}
      rotation = {[2, 4, 1]}
      >
        <boxGeometry />
        <meshNormalMaterial />
      </mesh>


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
            transparent={true}
          />
        </mesh>
   </>
  )}
