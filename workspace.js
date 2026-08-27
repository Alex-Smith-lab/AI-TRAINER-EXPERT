const supabaseClient = window.supabase.createClient(
  window.ATE_CONFIG.SUPABASE_URL,
  window.ATE_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const $ = id => document.getElementById(id);

const cameras = [
  "Front Wide",
  "Front Narrow",
  "Front Left",
  "Front Right",
  "Rear Left",
  "Rear",
  "Rear Right"
];

let session = null;
let profile = null;
let task = null;

let currentMode = "3d";
let currentCamera = "Front Wide";

let lidarCanvas;
let cameraCanvas;
let lidarCtx;
let cameraCtx;

let objects = [];
let selectedObject = null;

let drawing = false;
let drawStart = null;

const DEMO_POINTS = [];

for (let i = 0; i < 950; i++) {

  const angle = Math.random() * Math.PI * 2;
  const radius = 40 + Math.random() * 500;

  DEMO_POINTS.push({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * .48,
    z: Math.random() * 40
  });
}

function toast(text, type = "") {

  const el = $("workspaceToast");

  el.textContent = text;
  el.className = "status-message";

  if (type) {
    el.classList.add(type);
  }

  el.classList.remove("hidden");

  setTimeout(() => {
    el.classList.add("hidden");
  }, 3500);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getParams() {

  const params =
    new URLSearchParams(window.location.search);

  return {
    taskId: params.get("task"),
    mode: params.get("mode") || "3d"
  };
}

function setMode(mode) {

  currentMode = mode;

  const app = $("workspaceApp");

  if (mode === "2d") {
    app.classList.remove("mode-3d");
    app.classList.add("mode-2d");

    $("modeLabel").textContent = "2D";
    $("stageTitle").textContent = "2D CAMERA + LiDAR";
    $("stageSubtitle").textContent =
      "Edit 2D boxes and cross-check the 3D projection";

  } else {

    app.classList.remove("mode-2d");
    app.classList.add("mode-3d");

    $("modeLabel").textContent = "3D";
    $("stageTitle").textContent = "3D LiDAR";
    $("stageSubtitle").textContent =
      "Draw a cuboid around an object";
  }

  renderAll();
}

function renderCameraList() {

  $("cameraList").innerHTML =
    cameras.map(camera => `
      <button
        class="camera-item ${camera === currentCamera ? "active" : ""}"
        data-camera="${escapeHtml(camera)}">

        <div class="camera-thumb"></div>

        ${escapeHtml(camera)}

      </button>
    `).join("");

  document
    .querySelectorAll(".camera-item")
    .forEach(button => {

      button.onclick = () => {

        currentCamera =
          button.dataset.camera;

        $("cameraLabel").textContent =
          currentCamera;

        renderCameraList();
        renderAll();

      };

    });
}

function resizeCanvas() {

  const rect =
    $("lidarCanvas").getBoundingClientRect();

  const dpr =
    window.devicePixelRatio || 1;

  lidarCanvas.width =
    rect.width * dpr;

  lidarCanvas.height =
    rect.height * dpr;

  lidarCtx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  const cameraRect =
    $("cameraCanvas").getBoundingClientRect();

  cameraCanvas.width =
    cameraRect.width * dpr;

  cameraCanvas.height =
    cameraRect.height * dpr;

  cameraCtx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  renderAll();
}

function drawGrid() {

  const w = lidarCanvas.clientWidth;
  const h = lidarCanvas.clientHeight;

  lidarCtx.clearRect(0, 0, w, h);

  lidarCtx.fillStyle = "#010204";
  lidarCtx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * .65;

  lidarCtx.strokeStyle =
    "rgba(40,80,90,.28)";

  lidarCtx.lineWidth = 1;

  for (let r = 40; r < Math.max(w, h); r += 35) {

    lidarCtx.beginPath();

    lidarCtx.ellipse(
      cx,
      cy,
      r * 1.3,
      r * .35,
      0,
      0,
      Math.PI * 2
    );

    lidarCtx.stroke();
  }

  for (let a = -Math.PI; a <= Math.PI; a += Math.PI / 12) {

    lidarCtx.beginPath();

    lidarCtx.moveTo(cx, cy);

    lidarCtx.lineTo(
      cx + Math.cos(a) * w,
      cy + Math.sin(a) * h * .4
    );

    lidarCtx.stroke();
  }

  /* Point cloud */

  for (const p of DEMO_POINTS) {

    const scale =
      Math.min(w, h) / 1000;

    const x =
      cx + p.x * scale;

    const y =
      cy + p.y * scale;

    if (
      x < 0 ||
      x > w ||
      y < 0 ||
      y > h
    ) continue;

    const brightness =
      Math.max(
        0.2,
        Math.min(1, p.z / 40)
      );

    lidarCtx.fillStyle =
      `rgba(90,255,45,${brightness})`;

    lidarCtx.fillRect(
      x,
      y,
      1.8,
      1.8
    );
  }

  /* Vehicle coordinate axes */

  lidarCtx.lineWidth = 2;

  lidarCtx.strokeStyle = "#ef4444";

  lidarCtx.beginPath();
  lidarCtx.moveTo(cx, cy);
  lidarCtx.lineTo(cx + 45, cy);
  lidarCtx.stroke();

  lidarCtx.strokeStyle = "#22c55e";

  lidarCtx.beginPath();
  lidarCtx.moveTo(cx, cy);
  lidarCtx.lineTo(cx, cy - 45);
  lidarCtx.stroke();

  lidarCtx.fillStyle = "#a78bfa";
  lidarCtx.font = "11px Arial";

  lidarCtx.fillText(
    "EGO",
    cx + 8,
    cy - 8
  );
}

function projectObjectToScreen(obj) {

  const w = lidarCanvas.clientWidth;
  const h = lidarCanvas.clientHeight;

  const cx = w / 2;
  const cy = h * .65;

  return {
    x: cx + obj.cx,
    y: cy + obj.cy,
    w: obj.length * .55,
    h: obj.height * .42
  };
}

function drawCuboid(obj) {

  const p =
    projectObjectToScreen(obj);

  const x = p.x;
  const y = p.y;

  const w = Math.max(30, p.w);
  const h = Math.max(20, p.h);

  const depth = 16;

  lidarCtx.save();

  lidarCtx.strokeStyle =
    obj === selectedObject
      ? "#ffffff"
      : "#a7f3d0";

  lidarCtx.lineWidth =
    obj === selectedObject ? 2.5 : 1.5;

  lidarCtx.fillStyle =
    "rgba(34,197,94,.05)";

  /* front */
  lidarCtx.beginPath();

  lidarCtx.rect(
    x - w / 2,
    y - h / 2,
    w,
    h
  );

  lidarCtx.fill();
  lidarCtx.stroke();

  /* rear */
  lidarCtx.beginPath();

  lidarCtx.rect(
    x - w / 2 + depth,
    y - h / 2 - depth,
    w,
    h
  );

  lidarCtx.stroke();

  /* connectors */

  const corners = [
    [x-w/2,y-h/2],
    [x+w/2,y-h/2],
    [x-w/2,y+h/2],
    [x+w/2,y+h/2]
  ];

  const rearCorners = [
    [x-w/2+depth,y-h/2-depth],
    [x+w/2+depth,y-h/2-depth],
    [x-w/2+depth,y+h/2-depth],
    [x+w/2+depth,y+h/2-depth]
  ];

  for (let i = 0; i < 4; i++) {

    lidarCtx.beginPath();

    lidarCtx.moveTo(
      corners[i][0],
      corners[i][1]
    );

    lidarCtx.lineTo(
      rearCorners[i][0],
      rearCorners[i][1]
    );

    lidarCtx.stroke();
  }

  /* heading arrow */

  const angle =
    (obj.yaw || 0) * Math.PI / 180;

  const arrowLength = 55;

  const ax =
    x + Math.cos(angle) * arrowLength;

  const ay =
    y + Math.sin(angle) * arrowLength;

  lidarCtx.strokeStyle = "#ef4444";
  lidarCtx.fillStyle = "#ef4444";

  lidarCtx.lineWidth = 3;

  lidarCtx.beginPath();

  lidarCtx.moveTo(x, y);

  lidarCtx.lineTo(ax, ay);

  lidarCtx.stroke();

  const head = 9;

  lidarCtx.beginPath();

  lidarCtx.moveTo(ax, ay);

  lidarCtx.lineTo(
    ax - Math.cos(angle - .5) * head,
    ay - Math.sin(angle - .5) * head
  );

  lidarCtx.lineTo(
    ax - Math.cos(angle + .5) * head,
    ay - Math.sin(angle + .5) * head
  );

  lidarCtx.closePath();

  lidarCtx.fill();

  lidarCtx.fillStyle = "#ffffff";
  lidarCtx.font = "11px Arial";

  lidarCtx.fillText(
    `${obj.label} • ${obj.track_id.slice(0,8)}`,
    x - w / 2,
    y - h / 2 - 9
  );

  lidarCtx.restore();
}

function drawLidar() {

  drawGrid();

  for (const obj of objects) {
    drawCuboid(obj);
  }
}

function drawCameraScene() {

  const w = cameraCanvas.clientWidth;
  const h = cameraCanvas.clientHeight;

  cameraCtx.clearRect(0, 0, w, h);

  /* sky */

  cameraCtx.fillStyle = "#151d28";
  cameraCtx.fillRect(0, 0, w, h * .48);

  /* road */

  cameraCtx.fillStyle = "#11151a";

  cameraCtx.beginPath();

  cameraCtx.moveTo(0, h * .48);
  cameraCtx.lineTo(w, h * .38);
  cameraCtx.lineTo(w, h);
  cameraCtx.lineTo(0, h);

  cameraCtx.closePath();

  cameraCtx.fill();

  /* lane lines */

  cameraCtx.strokeStyle =
    "rgba(60,130,246,.55)";

  cameraCtx.lineWidth = 2;

  for (let i = 0; i < 5; i++) {

    cameraCtx.beginPath();

    cameraCtx.moveTo(
      w * (.15 + i*.18),
      h
    );

    cameraCtx.lineTo(
      w * (.48 + i*.03),
      h*.48
    );

    cameraCtx.stroke();
  }

  /* buildings / background */

  cameraCtx.fillStyle = "#202938";

  cameraCtx.fillRect(
    0,
    h*.25,
    w*.18,
    h*.25
  );

  cameraCtx.fillRect(
    w*.82,
    h*.2,
    w*.18,
    h*.28
  );

  /* demo vehicles */

  const vehicles = [
    {
      x: .28,
      y: .63,
      w: .16,
      h: .18
    },
    {
      x: .52,
      y: .57,
      w: .13,
      h: .16
    },
    {
      x: .72,
      y: .68,
      w: .18,
      h: .2
    }
  ];

  vehicles.forEach((v, i) => {

    const x = w * v.x;
    const y = h * v.y;

    const vw = w * v.w;
    const vh = h * v.h;

    cameraCtx.fillStyle =
      ["#475569","#e5e7eb","#991b1b"][i];

    cameraCtx.fillRect(
      x - vw/2,
      y - vh/2,
      vw,
      vh
    );

    cameraCtx.strokeStyle =
      "#22c55e";

    cameraCtx.lineWidth = 2;

    cameraCtx.strokeRect(
      x - vw/2,
      y - vh/2,
      vw,
      vh
    );
  });

  /* projected 3D objects */

  objects.forEach(obj => {

    const box =
      projectToCamera(obj);

    if (!box) return;

    cameraCtx.strokeStyle =
      obj === selectedObject
        ? "#ffffff"
        : "#22c55e";

    cameraCtx.lineWidth =
      obj === selectedObject ? 3 : 2;

    cameraCtx.strokeRect(
      box.x,
      box.y,
      box.w,
      box.h
    );

    cameraCtx.fillStyle =
      "#22c55e";

    cameraCtx.font =
      "11px Arial";

    cameraCtx.fillText(
      `${obj.label} ${obj.track_id.slice(0,6)}`,
      box.x,
      Math.max(12, box.y - 4)
    );
  });

  cameraCtx.fillStyle =
    "rgba(0,0,0,.65)";

  cameraCtx.fillRect(
    8,
    8,
    145,
    26
  );

  cameraCtx.fillStyle = "#ffffff";
  cameraCtx.font = "11px Arial";

  cameraCtx.fillText(
    currentCamera,
    17,
    25
  );
}

function projectToCamera(obj) {

  const w = cameraCanvas.clientWidth;
  const h = cameraCanvas.clientHeight;

  /*
   * This is the workspace's projection preview.
   *
   * For production autonomous-driving datasets,
   * replace this transformation with the actual
   * camera intrinsic/extrinsic calibration matrices.
   */

  let factor = 1;

  if (
    currentCamera === "Front Left" ||
    currentCamera === "Rear Left"
  ) {
    factor = .9;
  }

  if (
    currentCamera === "Front Right" ||
    currentCamera === "Rear Right"
  ) {
    factor = 1.1;
  }

  const p =
    projectObjectToScreen(obj);

  const nx =
    .5 + (p.x / lidarCanvas.clientWidth) * .55;

  const ny =
    .55 + (p.y / lidarCanvas.clientHeight) * .4;

  const bw =
    Math.max(25, p.w * factor);

  const bh =
    Math.max(25, p.h * factor);

  return {
    x: nx * w - bw/2,
    y: ny * h - bh/2,
    w: bw,
    h: bh
  };
}

function renderAll() {
  if (!lidarCanvas) return;

  drawLidar();
  drawCameraScene();

  $("boxCount").textContent =
    objects.length;
}

function canvasPosition(event) {

  const rect =
    lidarCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function screenToObjectPosition(point) {

  const w = lidarCanvas.clientWidth;
  const h = lidarCanvas.clientHeight;

  const cx = w/2;
  const cy = h*.65;

  return {
    cx: point.x - cx,
    cy: point.y - cy
  };
}

function startDrawing(event) {

  if (currentMode !== "3d") return;

  if (!profile.access_3d) {
    toast(
      "You do not have 3D annotation access.",
      "error"
    );
    return;
  }

  drawing = true;

  drawStart =
    canvasPosition(event);
}

function finishDrawing(event) {

  if (!drawing) return;

  drawing = false;

  const end =
    canvasPosition(event);

  const start =
    drawStart;

  const x =
    (start.x + end.x)/2;

  const y =
    (start.y + end.y)/2;

  const w =
    Math.abs(end.x - start.x);

  const h =
    Math.abs(end.y - start.y);

  if (w < 20 || h < 20) {
    renderAll();
    return;
  }

  const pos =
    screenToObjectPosition({
      x,
      y
    });

  const obj = {

    id: crypto.randomUUID(),

    track_id:
      "TRK-" +
      crypto.randomUUID()
        .slice(0,8)
        .toUpperCase(),

    label:
      $("classSelect").value,

    cx: pos.cx,
    cy: pos.cy,

    cz: 0,

    length:
      Math.max(40, w / .55),

    width:
      Math.max(25, w / .9),

    height:
      Math.max(35, h / .42),

    yaw:
      Number($("yawInput").value || 0),

    camera:
      currentCamera
  };

  objects.push(obj);

  selectedObject = obj;

  renderAll();

  save3DAnnotation(obj);
}

async function save3DAnnotation(obj) {

  const { error } =
    await supabaseClient
      .from("annotations")
      .insert({
        task_id: task.id,
        frame_id: null,
        created_by: session.user.id,
        annotation_type: "cuboid3d",
        label: obj.label,
        geometry: {
          cx: obj.cx,
          cy: obj.cy,
          cz: obj.cz,
          length: obj.length,
          width: obj.width,
          height: obj.height,
          yaw: obj.yaw,
          camera: obj.camera
        },
        track_id: obj.track_id,
        attributes: {
          source: "workspace",
          heading_verified: false,
          generated_to_2d: false
        }
      });

  if (error) {
    toast(error.message, "error");
    console.error(error);
    return;
  }

  toast(
    "3D cuboid saved.",
    "success"
  );

  await loadMetrics();
}

async function generate2D() {

  if (!selectedObject) {
    toast(
      "Select a 3D cuboid first.",
      "error"
    );
    return;
  }

  if (!profile.access_3d) {
    toast(
      "You do not have 3D access.",
      "error"
    );
    return;
  }

  const box =
    projectToCamera(selectedObject);

  const { error } =
    await supabaseClient
      .from("annotations")
      .insert({
        task_id: task.id,
        frame_id: null,
        created_by: session.user.id,
        annotation_type: "box2d",
        label: selectedObject.label,
        track_id: selectedObject.track_id,
        generated_from: null,
        geometry: {
          x: box.x,
          y: box.y,
          width: box.w,
          height: box.h,
          camera: currentCamera
        },
        attributes: {
          generated_from_3d: true,
          locked_for_3d: true,
          source_track_id: selectedObject.track_id
        }
      });

  if (error) {
    toast(error.message, "error");
    return;
  }

  toast(
    `2D box generated for ${currentCamera}.`,
    "success"
  );

  renderAll();
}

async function loadExistingAnnotations() {

  const { data, error } =
    await supabaseClient
      .from("annotations")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", {
        ascending: true
      });

  if (error) {
    console.error(error);
    return;
  }

  objects = [];

  for (const annotation of data || []) {

    if (
      annotation.annotation_type !== "cuboid3d"
    ) {
      continue;
    }

    const g =
      annotation.geometry || {};

    objects.push({
      id: annotation.id,
      track_id:
        annotation.track_id ||
        annotation.id.slice(0,8),
      label:
        annotation.label || "Unknown",
      cx: Number(g.cx || 0),
      cy: Number(g.cy || 0),
      cz: Number(g.cz || 0),
      length: Number(g.length || 80),
      width: Number(g.width || 45),
      height: Number(g.height || 60),
      yaw: Number(g.yaw || 0),
      camera:
        g.camera || currentCamera
    });
  }

  renderAll();
}

async function loadMetrics() {

  const { data, error } =
    await supabaseClient
      .from("annotations")
      .select("created_by,annotation_type")
      .eq("task_id", task.id);

  if (error) {
    console.error(error);
    return;
  }

  const counts = {};

  (data || []).forEach(a => {

    counts[a.created_by] =
      counts[a.created_by] || {
        total: 0,
        cuboid3d: 0,
        box2d: 0
      };

    counts[a.created_by].total++;

    if (a.annotation_type === "cuboid3d") {
      counts[a.created_by].cuboid3d++;
    }

    if (a.annotation_type === "box2d") {
      counts[a.created_by].box2d++;
    }
  });

  const ids =
    Object.keys(counts);

  if (!ids.length) {
    $("annotatorMetrics").innerHTML =
      `<div style="color:var(--muted);font-size:12px;">
        No annotations yet.
      </div>`;
    return;
  }

  const { data: directory } =
    await supabaseClient
      .from("annotator_directory")
      .select("id,full_name,role")
      .in("id", ids);

  const names =
    Object.fromEntries(
      (directory || []).map(x => [
        x.id,
        x.full_name
      ])
    );

  $("annotatorMetrics").innerHTML =
    ids.map(id => {

      const c = counts[id];

      return `
        <div style="
          padding:9px 0;
          border-bottom:1px solid var(--border);
          font-size:11px;">

          <strong>
            ${escapeHtml(names[id] || "Annotator")}
          </strong>

          <div style="color:var(--muted);margin-top:4px;">
            ${c.total} total
            • ${c.cuboid3d} 3D
            • ${c.box2d} 2D
          </div>

        </div>
      `;

    }).join("");
}

async function startTask() {

  const { error } =
    await supabaseClient.rpc(
      "start_task",
      {
        p_task_id: task.id
      }
    );

  if (error) {
    toast(error.message, "error");
  }
}

async function submitTask() {

  const confirmed =
    confirm(
      "Submit this task for review?"
    );

  if (!confirmed) return;

  const { error } =
    await supabaseClient.rpc(
      "submit_task",
      {
        p_task_id: task.id
      }
    );

  if (error) {
    toast(error.message, "error");
    return;
  }

  toast(
    "Task submitted successfully.",
    "success"
  );

  setTimeout(() => {
    window.location.href = "home.html";
  }, 900);
}

async function initialise() {

  const params =
    getParams();

  if (!params.taskId) {
    window.location.href = "home.html";
    return;
  }

  currentMode =
    params.mode === "2d"
      ? "2d"
      : "3d";

  const {
    data: sessionData
  } = await supabaseClient.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "index.html";
    return;
  }

  session =
    sessionData.session;

  const { data: profileData } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

  profile = profileData;

  if (!profile || profile.status !== "active") {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
    return;
  }

  /* Critical permission gate */

  if (
    currentMode === "3d" &&
    !profile.access_3d
  ) {

    toast(
      "ACCESS DENIED — Your account does not have 3D access.",
      "error"
    );

    setTimeout(() => {
      window.location.href = "home.html";
    }, 1000);

    return;
  }

  if (
    currentMode === "2d" &&
    !profile.access_2d
  ) {

    toast(
      "ACCESS DENIED — Your account does not have 2D access.",
      "error"
    );

    setTimeout(() => {
      window.location.href = "home.html";
    }, 1000);

    return;
  }

  const { data: taskData, error } =
    await supabaseClient
      .from("tasks")
      .select("*")
      .eq("id", params.taskId)
      .maybeSingle();

  if (error || !taskData) {

    toast(
      "ACCESS DENIED — You are not assigned to this task.",
      "error"
    );

    setTimeout(() => {
      window.location.href = "home.html";
    }, 1000);

    return;
  }

  task = taskData;

  if (task.task_type !== currentMode) {
    currentMode = task.task_type;
  }

  $("workspaceTaskName").textContent =
    task.name;

  lidarCanvas =
    $("lidarCanvas");

  cameraCanvas =
    $("cameraCanvas");

  lidarCtx =
    lidarCanvas.getContext("2d");

  cameraCtx =
    cameraCanvas.getContext("2d");

  renderCameraList();

  setMode(currentMode);

  window.addEventListener(
    "resize",
    resizeCanvas
  );

  setTimeout(
    resizeCanvas,
    100
  );

  await startTask();

  await loadExistingAnnotations();

  await loadMetrics();
}

$("lidarCanvas").addEventListener(
  "mousedown",
  startDrawing
);

$("lidarCanvas").addEventListener(
  "mouseup",
  finishDrawing
);

$("drawCuboidButton").onclick = () => {
  toast(
    "Drag on the LiDAR view to create a cuboid."
  );
};

$("generate2dButton").onclick =
  generate2D;

$("deleteSelectedButton").onclick =
  async () => {

    if (!selectedObject) {
      toast(
        "Select an object first.",
        "error"
      );
      return;
    }

    const id =
      selectedObject.id;

    const { error } =
      await supabaseClient
        .from("annotations")
        .delete()
        .eq("id", id);

    if (error) {
      toast(error.message, "error");
      return;
    }

    objects =
      objects.filter(
        x => x.id !== id
      );

    selectedObject = null;

    renderAll();

    await loadMetrics();
  };

$("classSelect").onchange = () => {

  if (!selectedObject) return;

  selectedObject.label =
    $("classSelect").value;

  renderAll();
};

$("yawInput").onchange = () => {

  if (!selectedObject) return;

  selectedObject.yaw =
    Number($("yawInput").value || 0);

  renderAll();
};

$("toggleModeButton").onclick = () => {

  const newMode =
    currentMode === "3d"
      ? "2d"
      : "3d";

  if (
    newMode === "3d" &&
    !profile.access_3d
  ) {

    toast(
      "3D access denied.",
      "error"
    );

    return;
  }

  if (
    newMode === "2d" &&
    !profile.access_2d
  ) {

    toast(
      "2D access denied.",
      "error"
    );

    return;
  }

  setMode(newMode);
};

$("closeWorkspaceButton").onclick = () => {
  window.location.href = "home.html";
};

$("submitTaskButton").onclick =
  submitTask;

$("expandLidarButton").onclick = () => {

  const stage =
    document.querySelector(".lidar-stage");

  if (
    document.fullscreenElement
  ) {
    document.exitFullscreen();
  } else {
    stage.requestFullscreen?.();
  }
};

$("resetViewButton").onclick = () => {
  renderAll();
};

initialise();
