(() => {
  'use strict';
  const slides = [
    ['THE DISCOVERY', 'These rocks are alive.', 'On isolated, floating planetary fragments, scientists found creatures made of loosely connected rocks. They move, react, and grow. Their name: Biological Rock Organisms. BROs, for short.', 'What holds them together? We’re still working on that.'],
    ['YOUR ASSIGNMENT', 'Welcome aboard B.R.O.S.', 'The Biological Rock Orbiting Station is your research base. As a researcher and caretaker, you hatch specimens, respond to their needs, train their abilities, and accompany them into the wild.', 'I’m your astronaut guide. The rocky creature is your BRO.'],
    ['CARE & GROWTH', 'Small beginnings. Seven forms.', 'Meet your Bro’s biological and behavioral Needs to keep its training progressing. Care and practice help it develop, revealing increasingly complex shapes and behaviors.', 'Observe. Care. Train. Get to know your specimen.'],
    ['THE ENDLESS WORLD', 'Step into their natural habitat.', 'Beyond the station lies a wilderness of floating islands, distinct ecosystems, unusual vegetation, and wild BROs. Explore, gather resources, and use practice battles to prepare your BRO for territory battles.', 'Out here, you’re studying life on its own terms.'],
    ['TERRITORIAL INSTINCTS', 'They fight for a place in the world.', 'BROs establish dominance through ritualized combat. Practice builds their abilities; territory battles decide who occupies a location. A defender stays on duty even when its caretaker is away.', 'One Bro. One location. A territory worth defending.'],
    ['YIELD & TERRITORY', 'Battle for the growth.', 'Your NFT is linked to an stETH staking position. Territory battles put available excess yield at stake, while protected principal grows as your BRO levels up and stays outside the battle stake. Winners gain yield; successful challengers can also claim a capped reward from the territory pot.', 'The stakes are yield. Read the field notes below before minting.']
  ];
  let current = 0;
  const byId = id => document.getElementById(id);
  const dots = slides.map((slide, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Slide ' + (index + 1) + ': ' + slide[0]);
    button.addEventListener('click', () => show(index));
    byId('steps').append(button);
    return button;
  });
  function show(index) {
    current = index;
    const [topic, title, body, note] = slides[index];
    byId('counter').textContent = 'BRIEFING / ' + String(index + 1).padStart(2, '0') + ' OF ' + String(slides.length).padStart(2, '0');
    byId('topic').textContent = '0' + (index + 1) + ' / ' + topic;
    byId('slide-title').textContent = title;
    byId('slide-body').textContent = body;
    byId('guide-note').textContent = '“' + note + '”';
    byId('previous').disabled = index === 0;
    byId('next').textContent = index === slides.length - 1 ? 'Go to mint ↗' : 'Next →';
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
  }
  byId('previous').addEventListener('click', () => show(Math.max(0, current - 1)));
  byId('next').addEventListener('click', () => current === slides.length - 1 ? location.assign('territory.html#management') : show(current + 1));
  byId('briefing').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !event.target.closest('button')) return;
    event.preventDefault();
    show(Math.max(0, Math.min(slides.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1))));
  });
  show(0);
  const host = byId('guide-scene');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  let renderer;
  try {
    const T = window.THREE;
    renderer = new T.WebGLRenderer({alpha:true, antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    byId('territory-backdrop').append(renderer.domElement);
    host.replaceChildren();
    renderer.autoClear = false;
    const territoryScene = new T.Scene();
    territoryScene.add(new T.HemisphereLight(0xe7f4ff, 0x40533c, 1.3));
    const territorySun = new T.DirectionalLight(0xffecd2, 1.3);
    territorySun.position.set(-20, 45, 30);
    territoryScene.add(territorySun);
    const territory = new T.Group();
    territoryScene.add(territory);
    const territoryCamera = new T.PerspectiveCamera(38, 1, .1, 500);
    // Reuse the actual generic territory, including its four biomes and paths.
    const world = window.BattleBrosTerritoryWorld.generate();
    const terrainColors = {sand:0xd9bb80,snow:0xdcecf0,grass:0x78935c,
      dirt:0x927154,stone:0x626875,water:0x4295b5,lava:0xed753e};
    const terrainGeometry = new T.BoxGeometry(1, 1, 1);
    const pose = new T.Object3D();
    for (const [type, color] of Object.entries(terrainColors)) {
      const cells = world.cells.filter(cell => cell.terrain === type);
      const material = new T.MeshLambertMaterial({color});
      const mesh = new T.InstancedMesh(terrainGeometry, material, cells.length);
      cells.forEach((cell, index) => {
        const height = cell.terrainFloors * .18 + 1.2;
        pose.position.set(cell.x - 24.5, height / 2 - 2, cell.z - 24.5);
        pose.rotation.set(0, 0, 0);
        pose.scale.set(1, height, 1);
        pose.updateMatrix();
        mesh.setMatrixAt(index, pose.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      territory.add(mesh);
    }
    const treeCells = world.cells.filter(cell => cell.kind === 'tree');
    const trees = new T.InstancedMesh(terrainGeometry,
      new T.MeshLambertMaterial({color:0x3f6944}), treeCells.length);
    treeCells.forEach((cell, index) => {
      pose.position.set(cell.x - 24.5, cell.terrainFloors * .18 + .4, cell.z - 24.5);
      pose.scale.set(.8, 2.4, .8);
      pose.updateMatrix();
      trees.setMatrixAt(index, pose.matrix);
    });
    trees.instanceMatrix.needsUpdate = true;
    territory.add(trees);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(35, 1, .1, 50);
    camera.position.set(3.4, 2.8, 5.4);
    camera.lookAt(0, .55, 0);
    scene.add(new T.HemisphereLight(0xfff5dc, 0x435b4b, 1.4));
    const sun = new T.DirectionalLight(0xffe8bb, 1.8);
    sun.position.set(-3, 5, 4); scene.add(sun);
    const box = new T.BoxGeometry(1,1,1);
    const materials = [0xd8d9d2,0x354b56,0x8b9993,0x81965b,0x9b8164,0xc4cf8e].map(color => new T.MeshLambertMaterial({color}));
    function cube(parent, material, x,y,z,w,h,d) {
      const mesh = new T.Mesh(box, materials[material]);
      mesh.position.set(x,y,z); mesh.scale.set(w,h,d); parent.add(mesh); return mesh;
    }
    const island = new T.Group(); scene.add(island);
    for(let x=-2;x<=2;x++) for(let z=-2;z<=2;z++){
      if(Math.abs(x)+Math.abs(z)>3) continue;
      cube(island,4,x*.43,-.35,z*.43,.43,.5,.43);
      cube(island,3,x*.43,-.07,z*.43,.43,.10,.43);
    }
    const bro = new T.Group(); scene.add(bro); bro.scale.setScalar(1.8);
    // Same block proportions and suit palette as the game's ambient astronauts.
    cube(bro,0,0,.46,0,.32,.38,.23);
    cube(bro,0,0,.82,0,.43,.36,.36);
    cube(bro,1,0,.83,.185,.32,.19,.025);
    cube(bro,2,0,.49,-.18,.25,.29,.14);
    cube(bro,0,-.24,.47,0,.12,.34,.13);
    const arm = new T.Group(); arm.position.set(.24,.61,0); bro.add(arm);
    cube(arm,0,0,-.14,0,.12,.34,.13);
    cube(bro,1,-.10,.15,0,.13,.30,.16);
    cube(bro,1,.10,.15,0,.13,.30,.16);
    const rock = cube(scene,4,-1,.9,.2,.23,.2,.24);
    rock.rotation.set(.4,.3,.6);
    const juggernautHost = byId('juggernaut-scene');
    // Copy character viewports into local transparent canvases. The WebGL canvas
    // stays exclusively behind the page, so terrain cannot overlap section content.
    function localPreview(element) {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      element.append(canvas);
      return {element, canvas, context:canvas.getContext('2d')};
    }
    const guidePreview = localPreview(host);
    const broPreview = localPreview(juggernautHost);
    function renderPreview(preview, previewScene, previewCamera, width, height) {
      const rect = preview.element.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= height) return;
      const ratio = renderer.getPixelRatio();
      const pixelWidth = Math.round(rect.width * ratio);
      const pixelHeight = Math.round(rect.height * ratio);
      if (preview.canvas.width !== pixelWidth || preview.canvas.height !== pixelHeight) {
        preview.canvas.width = pixelWidth;
        preview.canvas.height = pixelHeight;
      }
      renderer.setViewport(rect.left, height - rect.bottom, rect.width, rect.height);
      renderer.setScissor(rect.left, height - rect.bottom, rect.width, rect.height);
      renderer.setScissorTest(true);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(previewScene, previewCamera);
      const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
      const right = Math.min(width, rect.right), bottom = Math.min(height, rect.bottom);
      preview.context.clearRect(0, 0, pixelWidth, pixelHeight);
      if (right > left && bottom > top) {
        preview.context.drawImage(renderer.domElement,
          left * ratio, top * ratio, (right-left) * ratio, (bottom-top) * ratio,
          (left-rect.left) * ratio, (top-rect.top) * ratio,
          (right-left) * ratio, (bottom-top) * ratio);
      }
    }
    const juggernautScene = new T.Scene();
    const juggernautCamera = new T.PerspectiveCamera(35, 1, .1, 50);
    juggernautScene.add(new T.HemisphereLight(0xffeedc, 0x53665c, 1.5));
    const broLight = new T.DirectionalLight(0xffd7a7, 1.8);
    broLight.position.set(-3, 5, 5);
    juggernautScene.add(broLight);
    let juggernaut = null, broMixer = null, broDuration = 0, broElapsed = 0;
    new T.ObjectLoader().load('assets/landing-juggernaut.json', model => {
      if (model.animations.length) {
        broDuration = model.animations[0].duration;
        broMixer = new T.AnimationMixer(model);
        broMixer.clipAction(model.animations[0]).play();
      }
      const bounds = new T.Box3().setFromObject(model);
      const center = bounds.getCenter(new T.Vector3());
      const size = bounds.getSize(new T.Vector3());
      const scale = 2.7 / Math.max(size.x, size.y, size.z);
      model.position.sub(center);
      juggernaut = new T.Group();
      juggernaut.add(model);
      juggernaut.scale.setScalar(scale);
      juggernaut.rotation.y = -.3;
      juggernautScene.add(juggernaut);
      byId('juggernaut-fallback').hidden = true;
    }, undefined, () => {
      byId('juggernaut-fallback').textContent = 'Preview unavailable. Meet the Juggernaut in the world.';
    });
    function resize() {
      const width = window.innerWidth, height = window.innerHeight;
      renderer.setSize(width,height,false);
      territoryCamera.aspect = width / height;
      // Fit the complete board even on portrait screens.
      const distance = 105 * Math.max(1, height / width);
      territoryCamera.position.set(distance * .65, distance * .85, distance * .65);
      territoryCamera.lookAt(0, 3, 0);
      // Lift the island slightly in the frame without changing its scale or orbit.
      territoryCamera.setViewOffset(width, height, 0, height * .055, width, height);
      territoryCamera.updateProjectionMatrix();
      const rect = host.getBoundingClientRect();
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      const broRect = juggernautHost.getBoundingClientRect();
      juggernautCamera.aspect = broRect.width / broRect.height;
      juggernautCamera.position.set(0, .3, 5.7 * Math.max(1, broRect.height / broRect.width));
      juggernautCamera.lookAt(0, 0, 0);
      juggernautCamera.updateProjectionMatrix();
    }
    const viewportObserver = new ResizeObserver(resize);
    viewportObserver.observe(host);
    viewportObserver.observe(juggernautHost);
    window.addEventListener('resize', resize); resize();
    function syncMotion() {
      byId('motion').textContent = paused ? 'Play animations' : 'Pause animations';
      byId('motion').setAttribute('aria-pressed',String(paused));
    }
    byId('motion').addEventListener('click',()=>{paused=!paused;syncMotion();});
    reduced.addEventListener('change',event=>{paused=event.matches;syncMotion();});
    syncMotion();
    let elapsed=0, previous=0;
    renderer.setAnimationLoop(time=>{
      const dt=Math.min((time-previous)/1000,.05); previous=time;
      if(!paused&&!document.hidden) elapsed+=dt;
      arm.rotation.z = 2.3 + Math.sin(elapsed*3)*.35;
      arm.rotation.x = current === 1 ? -.7 : 0;
      bro.rotation.y = -.18 + Math.sin(elapsed*.8)*.12;
      rock.position.y = .95 + Math.sin(elapsed*1.5)*.12;
      rock.rotation.y = elapsed*.5;
      if (document.hidden) return;
      const broVisibility = juggernautHost.getBoundingClientRect();
      if (broMixer && !paused && broVisibility.bottom > 0 && broVisibility.top < window.innerHeight) {
        broElapsed = (broElapsed + dt) % (broDuration * 2);
        // Slow to rest at either end, then retrace the drift without a reset.
        const phase = broElapsed / broDuration * Math.PI;
        const clipTime = (broDuration - 1e-6) * (1 - Math.cos(phase)) / 2;
        broMixer.setTime(clipTime);
      }
      territory.rotation.y = -.35 + elapsed * .025;
      const width = window.innerWidth, height = window.innerHeight;
      renderPreview(guidePreview, scene, camera, width, height);
      renderPreview(broPreview, juggernautScene, juggernautCamera, width, height);
      // Finish with only the territory in the background canvas.
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      renderer.setClearColor(0x19332d, 1);
      renderer.clear();
      renderer.render(territoryScene, territoryCamera);
    });
  } catch {
    if(renderer) { renderer.domElement.remove(); renderer.dispose(); }
    host.innerHTML = '<p class="scene-fallback">Your mission starts here.</p>';
    byId('motion').hidden = true;
    byId('juggernaut-fallback').textContent = 'Meet the Juggernaut in the world.';
  }
})();
