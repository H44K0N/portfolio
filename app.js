// tischbein.dev: nav that swaps the showcase panel, and one small raymarched WebGL object.
// No libraries. The scene is a single fragment shader on a small canvas.
(() => {
  "use strict";

  const ORDER = ["sjekka", "stud", "alfred", "pulse", "ai", "about"];
  const ACCENT = {
    sjekka: "#2f9d6c",
    stud: "#3f6fb5",
    alfred: "#e2a019",
    pulse: "#e5533c",
    ai: "#7a5cd6",
    about: "#2b2926",
  };

  const tabs = [...document.querySelectorAll(".tabs a[data-panel]")];
  const panels = new Map(ORDER.map((id) => [id, document.getElementById(id)]));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = null;
  let scene = null;

  function activate(id, { setHash = false } = {}) {
    if (!panels.get(id)) return;
    if (setHash && location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    if (id === current) return;
    current = id;
    for (const [pid, el] of panels) el.hidden = pid !== id;
    for (const t of tabs) {
      const on = t.dataset.panel === id;
      t.classList.toggle("on", on);
      if (on) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current");
    }
    document.documentElement.style.setProperty("--accent", ACCENT[id]);
    document.documentElement.dataset.panel = id;

    // media is only fetched once its panel is first shown
    for (const v of document.querySelectorAll("video")) {
      const mine = panels.get(id).contains(v);
      if (mine) {
        if (!v.dataset.loaded) {
          for (const s of v.querySelectorAll("source[data-src]")) s.src = s.dataset.src;
          v.load();
          v.dataset.loaded = "1";
        }
        if (!reduced) v.play().catch(() => {});
      } else {
        v.pause();
      }
    }
    if (scene) scene.show(ORDER.indexOf(id), ACCENT[id]);
  }

  // hover shows a panel (with a short delay so sweeping across the bar doesn't flicker),
  // click or keyboard focus selects it and puts it in the address bar
  let hoverTimer = 0;
  for (const t of tabs) {
    const id = t.dataset.panel;
    t.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => activate(id), 70);
    });
    t.addEventListener("pointerleave", () => clearTimeout(hoverTimer));
    t.addEventListener("focus", () => activate(id));
    t.addEventListener("click", (e) => {
      e.preventDefault();
      clearTimeout(hoverTimer);
      activate(id, { setHash: true });
    });
  }
  // links inside panels that point at another panel
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-goto]");
    if (!a) return;
    e.preventDefault();
    activate(a.dataset.goto, { setHash: true });
    document.querySelector(".tabs").scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  });
  addEventListener("hashchange", () => activate(location.hash.slice(1)));

  // the address is only assembled on click, so it never appears in the page source
  const reveal = document.querySelector(".reveal");
  if (reveal) {
    reveal.addEventListener("click", (e) => {
      const { a, b, c } = e.currentTarget.dataset;
      const address = a + b + "@" + c;
      const link = document.createElement("a");
      link.href = "mailto:" + address;
      link.textContent = address;
      link.className = "pill primary";
      e.currentTarget.replaceWith(link);
      link.focus();
    });
  }

  // ---------- the 3D object ----------

  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uA, uB, uMix, uSpin;
uniform vec2 uPtr;
uniform vec3 uColA, uColB;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float dot2(vec2 v){ return dot(v,v); }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float smin(float a, float b, float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float sdHeart(vec2 p){
  p.x=abs(p.x);
  if(p.y+p.x>1.0) return sqrt(dot2(p-vec2(0.25,0.75)))-0.35355;
  return sqrt(min(dot2(p-vec2(0.0,1.0)), dot2(p-0.5*max(p.x+p.y,0.0))))*sign(p.x-p.y);
}
float beat(){ float t=uTime*2.2; return pow(0.5+0.5*sin(t),8.0)+0.5*pow(0.5+0.5*sin(t-0.9),8.0); }
vec3 orb(float i){
  float a=uTime*0.9+i*1.5708;
  vec3 p=vec3(cos(a),0.0,sin(a))*0.78;
  p.xy=rot(0.6+i*0.9)*p.xy;
  return p;
}

// receipt, book, bow tie, heart, orbiting cluster, letter H
float shape(vec3 p, float id){
  if(id<0.5){
    vec3 q=p; q.z-=0.06*sin(q.y*3.2+uTime*1.3);
    float d=sdBox(q,vec3(0.5,0.9,0.012))-0.012;
    float tri=abs(fract(q.x*5.0)-0.5)*2.0;
    d=max(d,((-0.84+0.07*tri)-q.y)*0.7);
    return d*0.8;
  }
  if(id<1.5){
    float pages=sdBox(p-vec3(0.02,0.0,0.0),vec3(0.5,0.69,0.105));
    float outer=sdBox(p,vec3(0.55,0.75,0.15))-0.02;
    float carve=sdBox(p-vec3(0.12,0.0,0.0),vec3(0.56,1.0,0.115));
    return min(max(outer,-carve),pages);
  }
  if(id<2.5){
    vec3 q=vec3(abs(p.x),p.y,p.z);
    float k=smoothstep(0.0,0.85,q.x);
    float wing=max(q.x-0.9,max(abs(q.y)-mix(0.14,0.5,k),abs(q.z)-mix(0.08,0.15,k)))-0.05;
    float knot=sdBox(p,vec3(0.12,0.19,0.16))-0.07;
    return smin(wing*0.8,knot,0.06);
  }
  if(id<3.5){
    float s=1.45*(1.0+0.07*beat());
    float d2=sdHeart(p.xy/s+vec2(0.0,0.58))*s;
    return (length(vec2(max(d2+0.27,0.0),p.z))-0.27)*0.9;
  }
  if(id<4.5){
    float d=length(p)-0.42;
    for(int i=0;i<4;i++){ d=smin(d,length(p-orb(float(i)))-0.16,0.16); }
    return d;
  }
  float legs=sdBox(vec3(abs(p.x)-0.42,p.y,p.z),vec3(0.13,0.72,0.13));
  float bar=sdBox(p,vec3(0.42,0.12,0.13));
  return min(legs,bar)-0.045;
}

vec3 albedo(vec3 p, float id, vec3 acc){
  vec3 paper=vec3(0.97,0.955,0.92);
  if(id<0.5){
    float row=floor(p.y*7.0+0.5), f=abs(fract(p.y*7.0+0.5)-0.5);
    float len=0.18+0.2*fract(sin(row*12.9898)*43758.5453);
    float ink=step(f,0.13)*step(abs(p.x+0.36-len),len)*step(abs(p.y),0.72);
    vec3 c=mix(paper,vec3(0.25),ink*0.75);
    float total=step(abs(p.y+0.57),0.045)*step(abs(p.x-0.2),0.2);
    return mix(c,acc,max(total,step(0.62,p.y)*step(abs(p.x),0.2)*step(p.y,0.74)));
  }
  if(id<1.5){
    float pages=sdBox(p-vec3(0.02,0.0,0.0),vec3(0.5,0.69,0.105));
    float outer=sdBox(p,vec3(0.55,0.75,0.15))-0.02;
    float carve=sdBox(p-vec3(0.12,0.0,0.0),vec3(0.56,1.0,0.115));
    if(pages<max(outer,-carve)) return paper*(0.9+0.1*step(0.5,fract(p.z*45.0)));
    float label=smoothstep(0.31,0.29,abs(p.x-0.03))*smoothstep(0.14,0.12,abs(p.y-0.3))*step(0.0,p.z);
    return mix(acc,paper,label);
  }
  if(id<2.5){ return acc*mix(0.72,1.0,smoothstep(0.1,0.28,abs(p.x))); }
  if(id<3.5){ return acc; }
  if(id<4.5){ return mix(vec3(0.17,0.16,0.19),acc,smoothstep(0.4,0.56,length(p))); }
  return acc;
}

vec3 toLocal(vec3 p){
  p.yz=rot(-0.3+0.08*sin(uTime*0.37)-uPtr.y*0.35)*p.yz;
  p.xz=rot(0.45+0.4*sin(uTime*0.5)+uPtr.x*0.6+uSpin)*p.xz;
  return p;
}
float map(vec3 p){
  p=toLocal(p);
  if(uMix<=0.0) return shape(p,uA);
  if(uMix>=1.0) return shape(p,uB);
  return mix(shape(p,uA),shape(p,uB),uMix);
}
vec3 normal(vec3 p){
  vec2 e=vec2(0.0015,-0.0015);
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));
}
float shadow(vec3 ro, vec3 rd, float k){
  float res=1.0, t=0.04;
  for(int i=0;i<16;i++){
    float h=map(ro+rd*t);
    res=min(res,k*h/t);
    t+=clamp(h,0.04,0.35);
    if(res<0.01||t>3.6) break;
  }
  return clamp(res,0.0,1.0);
}

void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-uRes)/uRes.y;
  vec3 ro=vec3(0.0,0.35,4.6);
  vec3 fw=normalize(vec3(0.0,-0.12,0.0)-ro), rt=normalize(cross(fw,vec3(0.0,1.0,0.0))), up=cross(rt,fw);
  vec3 rd=normalize(uv.x*rt+uv.y*up+3.2*fw);
  vec3 L=normalize(vec3(-0.22,0.9,0.4));
  float px=2.0/(uRes.y*3.2);

  // only march rays that can touch the object
  float b=dot(ro,rd), c=dot(ro,ro)-1.69, disc=b*b-c;
  float hit=0.0, cover=0.0, t=0.0;
  if(disc>0.0){
    float sq=sqrt(disc), tmax=-b+sq, best=1e9, tb=0.0;
    t=max(-b-sq,0.0);
    for(int i=0;i<56;i++){
      float d=map(ro+rd*t);
      if(d/t<best){ best=d/t; tb=t; }
      if(d<0.0012*t){ hit=1.0; break; }
      t+=d;
      if(t>tmax) break;
    }
    if(hit>0.5) cover=1.0;
    else if(best<px*1.5){ cover=1.0-best/(px*1.5); t=tb; }
  }

  vec4 col=vec4(0.0);
  // soft shadow on an invisible floor
  float tg=(-1.22-ro.y)/rd.y;
  if(rd.y<0.0 && cover<1.0){
    vec3 g=ro+rd*tg;
    float r=length(g.xz);
    if(r<2.4){
      float a=(1.0-shadow(g,L,5.0))*0.26*smoothstep(2.4,1.2,r)*smoothstep(1.0,0.78,max(abs(uv.x),abs(uv.y)));
      col=vec4(vec3(0.16,0.13,0.1)*a,a);
    }
  }
  if(cover>0.0){
    vec3 p=ro+rd*t, n=normal(p), q=toLocal(p);
    vec3 alb=albedo(q,uA,uColA);
    if(uMix>0.0) alb=mix(alb,albedo(q,uB,uColB),uMix);
    alb*=alb; // to linear, roughly
    float dif=clamp(dot(n,L)*0.6+0.4,0.0,1.0);
    dif*=mix(0.45,1.0,shadow(p+n*0.01,L,9.0));
    float ao=clamp(0.5+map(p+n*0.12)/0.24,0.0,1.0)*clamp(0.6+map(p+n*0.3)/0.75,0.0,1.0);
    vec3 lin=dif*vec3(1.12,1.06,0.98);
    lin+=(0.34+0.2*n.y)*vec3(0.86,0.9,1.0)*ao;
    lin+=clamp(-n.y,0.0,1.0)*0.16*vec3(1.0,0.93,0.82)*ao;
    vec3 h=normalize(L-rd);
    float spec=pow(clamp(dot(n,h),0.0,1.0),36.0)*0.2*dif;
    float fres=pow(1.0-clamp(dot(n,-rd),0.0,1.0),3.0);
    vec3 c3=alb*lin+spec+fres*0.1*ao;
    c3=sqrt(clamp(c3,0.0,1.0));
    col=vec4(c3*cover,cover)+col*(1.0-cover);
  }
  gl_FragColor=col;
}`;

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function makeScene(canvas) {
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return null;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}"));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.bindAttribLocation(prog, 0, "p");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) {
      console.warn("3D scene disabled:", err.message);
      return null;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    for (const n of ["uRes", "uTime", "uA", "uB", "uMix", "uSpin", "uPtr", "uColA", "uColB"]) U[n] = gl.getUniformLocation(prog, n);

    const st = { a: 5, b: 5, mix: 1, colA: hexToRgb(ACCENT.about), colB: hexToRgb(ACCENT.about), start: 0, ptr: [0, 0], ptrT: [0, 0] };
    let scale = Math.min(devicePixelRatio || 1, 2);
    let visible = true, raf = 0, slow = 0, frames = 0, last = 0;
    const DUR = 620;

    function resize() {
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      if (canvas.width !== w) { canvas.width = w; canvas.height = w; }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function draw(now) {
      raf = 0;
      resize();
      const k = Math.min(1, (now - st.start) / DUR);
      st.mix = k * k * (3 - 2 * k);
      st.ptr[0] += (st.ptrT[0] - st.ptr[0]) * 0.08;
      st.ptr[1] += (st.ptrT[1] - st.ptr[1]) * 0.08;
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, reduced ? 2.0 : now / 1000);
      gl.uniform1f(U.uA, st.a);
      gl.uniform1f(U.uB, st.b);
      gl.uniform1f(U.uMix, st.mix);
      gl.uniform1f(U.uSpin, reduced ? 0 : (1 - st.mix) * -3.1416);
      gl.uniform2f(U.uPtr, st.ptr[0], st.ptr[1]);
      gl.uniform3fv(U.uColA, st.colA);
      gl.uniform3fv(U.uColB, st.colB);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // drop resolution on machines that can't keep up
      if (last && frames < 90) {
        frames++;
        if (now - last > 28) slow++;
        if (frames === 45 && slow > 22 && scale > 0.75) { scale *= 0.66; slow = 0; frames = 0; }
      }
      last = now;
      if (!reduced || k < 1) schedule();
    }
    function schedule() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw);
    }

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = 0; schedule(); }).observe(canvas);
    document.addEventListener("visibilitychange", () => { last = 0; schedule(); });
    addEventListener("resize", schedule);
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = canvas.getBoundingClientRect();
      st.ptrT[0] = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / innerWidth * 2));
      st.ptrT[1] = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / innerHeight * 2));
      if (reduced) schedule();
    }, { passive: true });
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); canvas.closest(".object").classList.add("no-gl"); });

    return {
      show(index, hex) {
        // if a morph is still running, start the next one from wherever it is heading
        st.a = st.b; st.colA = st.colB;
        st.b = index; st.colB = hexToRgb(hex);
        st.start = performance.now();
        if (reduced) st.start -= DUR;
        schedule();
      },
    };
  }

  const canvas = document.getElementById("object");
  if (canvas) {
    scene = makeScene(canvas);
    if (!scene) canvas.closest(".object").classList.add("no-gl");
  }

  const first = location.hash.slice(1);
  activate(panels.get(first) ? first : "about");
  if (scene) { scene.show(ORDER.indexOf(current), ACCENT[current]); }
})();
