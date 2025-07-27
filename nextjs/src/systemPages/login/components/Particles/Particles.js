'use client';
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { useCallback, useState, useEffect } from "react";

const ParticlesComponent = (props) => {
  const [particleNumber, setParticleNumber] = useState(0);

  useEffect(() => {
    setParticleNumber(window.innerWidth / 10);
  }, []);

  const options = {
    fullScreen: {
      enable: true,
      zIndex: -1,
    },
    fpsLimit: 30,
    detectRetina: true,
    interactivity: {
      events: {
        onClick: {
          enable: false,
          mode: "push",
        },
        onHover: {
          enable: true,
          mode: "repulse",
        },
      },
      modes: {
        push: {
          quantity: 10,
        },
        repulse: {
          distance: 100,
        },
      },
    },
    particles: {
      links: {
        enable: true,
        distance: 150,
        opacity: 0.5
      },
      move: {
        enable: true,
        speed: { min: 0.01, max: 1.0 },
      },
      opacity: {
        value: { min: 0.0, max: 0.2 },
      },
      size: {
        value: { min: 1, max: 3 },
      },
      number: {
        value: particleNumber,
      },
    },
  }
  

  const particlesInit = useCallback(async options => {
    await loadSlim(options);
  }, []);

  return <Particles id={props.id} init={particlesInit} options={options} />;
};

export default ParticlesComponent;
