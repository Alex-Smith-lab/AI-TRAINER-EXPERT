/* ============================================================
   AI TRAINER EXPERT
   SUPABASE + AUTH + TASKS + 2D/3D WORKSPACE
============================================================ */

const SUPABASE_URL =
  "https://mllmldgwzvkprpwkmfdlh.supabase.co";

/*
 * Browser-safe publishable key.
 *
 * IMPORTANT:
 * Never put a Supabase secret/service-role key here.
 */
const SUPABASE_KEY =
  "sb_publishable_8WucrYYIhnr1EXdNMkdMsQ_vFtZecB2";

const { createClient } =
  window.supabase;

const db =
  createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );


/* ============================================================
   GLOBAL STATE
============================================================ */

let session = null;
let currentUser = null;
let profile = null;

let currentTask = null;
let currentFrames = [];

let currentFrameIndex = 0;

let currentCamera = "Front Wide";

let annotations = [];

let drawing = false;

let drawStart = null;

let drawingMode = false;

let workspaceExpandedLidar = false;
let workspaceExpandedCamera = false;

const cameras = [
  "Front Wide",
  "Front Narrow",
  "Front Left",
  "Front Right",
  "Rear Left",
  "Rear Right",
  "Rear"
];

const $ = id =>
  document.getElementById(id);


/* ============================================================
   START
============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    bindEvents();

    updateClock();

    setInterval(updateClock, 30000);

    const {
      data
    } = await db.auth.getSession();

    session =
      data.session;

    if (session) {
      await initializeUser();
    } else {
      showAuth();
    }

    db.auth.onAuthStateChange(
      async (event, newSession) => {

        session =
          newSession;

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          await initializeUser();
        }

        if (
          event === "SIGNED_OUT"
        ) {
          showAuth();
        }
      }
    );
  }
);


/* ============================================================
   EVENTS
============================================================ */

function bindEvents() {

  $("loginForm")
    .addEventListener(
      "submit",
      login
    );

  $("forgotBtn")
    .addEventListener(
      "click",
      forgotPassword
    );

  $("requestAccessBtn")
    .addEventListener(
      "click",
      showSignup
    );

  $("logoutBtn")
    .addEventListener(
      "click",
      logout
    );

  $("closeWorkspace")
    .addEventListener(
      "click",
      closeWorkspace
    );

  $("submitTaskBtn")
    .addEventListener(
      "click",
      submitCurrentTask
    );

  $("drawBoxBtn")
    .addEventListener(
      "click",
      enableDrawing
    );

  $("generate2DBtn")
    .addEventListener(
      "click",
      generate2DBoxes
    );

  $("cameraSelect")
    .addEventListener(
      "change",
      e => {
        currentCamera =
          e.target.value;

        renderCamera();
      }
    );

  $("frameSlider")
    .addEventListener(
      "input",
      e => {
        currentFrameIndex =
          Number(e.target.value);

        renderWorkspaceFrame();
      }
    );

  $("previousFrame")
    .addEventListener(
      "click",
      previousFrame
    );

  $("nextFrame")
    .addEventListener(
      "click",
      nextFrame
    );

  $("lidarClose")
    .addEventListener(
      "click",
      () => {
        $("lidarPanel")
          .classList
          .toggle("hidden");
      }
    );

  $("cameraClose")
    .addEventListener(
      "click",
      () => {
        $("cameraPanel")
          .classList
          .toggle("hidden");
      }
    );

  $("lidarExpand")
    .addEventListener(
      "click",
      () => {
        $("lidarPanel")
          .classList
          .toggle("expanded-panel");
      }
    );

  $("cameraExpand")
    .addEventListener(
      "click",
      () => {
        $("cameraPanel")
          .classList
          .toggle("expanded-panel");
      }
    );

  $("refreshAdminBtn")
    .addEventListener(
      "click",
      loadAdmin
    );

  $("createTaskForm")
    .addEventListener(
      "submit",
      createTask
    );

  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;

          navigate(page);

        }
      );
    });

  const lidarCanvas =
    $("lidarCanvas");

  lidarCanvas.addEventListener(
    "mousedown",
    lidarMouseDown
  );

  lidarCanvas.addEventListener(
    "mousemove",
    lidarMouseMove
  );

  lidarCanvas.addEventListener(
    "mouseup",
    lidarMouseUp
  );

  const cameraCanvas =
    $("cameraCanvas");

  cameraCanvas.addEventListener(
    "mousedown",
    cameraMouseDown
  );

  cameraCanvas.addEventListener(
    "mousemove",
    cameraMouseMove
  );

  cameraCanvas.addEventListener(
    "mouseup",
    cameraMouseUp
  );

  $("modalClose")
    .addEventListener(
      "click",
      closeModal
    );

  window.addEventListener(
    "resize",
    () => {
      if (
        !$("workspace")
          .classList
          .contains("hidden")
      ) {
        renderLidar();
        renderCamera();
      }
    }
  );
}


/* ============================================================
   AUTH
============================================================ */

function showAuth() {

  $("authScreen")
    .classList
    .remove("hidden");

  $("app")
    .classList
    .add("hidden");

  $("workspace")
    .classList
    .add("hidden");
}


async function login(e) {

  e.preventDefault();

  const email =
    $("email")
      .value
      .trim()
      .toLowerCase();

  const password =
    $("password")
      .value;

  setAuthMessage(
    "Signing in..."
  );

  const {
    data,
    error
  } =
    await db.auth
      .signInWithPassword({
        email,
        password
      });

  if (error) {

    setAuthMessage(
      error.message
    );

    return;
  }

  session =
    data.session;

  await initializeUser();
}


async function forgotPassword() {

  const email =
    $("email")
      .value
      .trim();

  if (!email) {

    setAuthMessage(
      "Enter your email address first."
    );

    return;
  }

  setAuthMessage(
    "Sending password reset email..."
  );

  const redirectTo =
    window.location.origin +
    window.location.pathname;

  const {
    error
  } =
    await db.auth
      .resetPasswordForEmail(
        email,
        {
          redirectTo
        }
      );

  if (error) {

    setAuthMessage(
      error.message
    );

    return;
  }

  setAuthMessage(
    "If that account exists, a password reset email has been sent."
  );
}


function showSignup() {

  openModal(`
    <h3>Request workspace access</h3>

    <p class="modal-text">
      Create your account. New accounts are placed on
      the WAITLIST until an administrator gives access.
    </p>

    <input
      id="signupName"
      placeholder="Full name"
      style="margin-bottom:10px"
    >

    <input
      id="signupEmail"
      type="email"
      placeholder="Email address"
      style="margin-bottom:10px"
    >

    <input
      id="signupPassword"
      type="password"
      placeholder="Password"
      style="margin-bottom:15px"
    >

    <button
      class="primary-button full"
      onclick="signupUser()"
    >
      Create account
    </button>

    <div
      id="signupMessage"
      class="message"
    ></div>
  `);
}


async function signupUser() {

  const name =
    $("signupName")
      .value
      .trim();

  const email =
    $("signupEmail")
      .value
      .trim()
      .toLowerCase();

  const password =
    $("signupPassword")
      .value;

  if (
    !name ||
    !email ||
    password.length < 6
  ) {

    $("signupMessage")
      .textContent =
      "Enter your name, email and a password of at least 6 characters.";

    return;
  }

  $("signupMessage")
    .textContent =
    "Creating account...";

  const {
    data,
    error
  } =
    await db.auth
      .signUp({
        email,
        password,

        options: {
          data: {
            full_name: name
          }
        }
      });

  if (error) {

    $("signupMessage")
      .textContent =
      error.message;

    return;
  }

  if (!data.session) {

    $("signupMessage")
      .textContent =
      "Account created. Check your email to confirm it, then wait for administrator approval.";

    return;
  }

  closeModal();

  await initializeUser();
}


async function logout() {

  await db.auth.signOut();

  session = null;
  currentUser = null;
  profile = null;

  showAuth();
}


function setAuthMessage(message) {

  $("authMessage")
    .textContent =
    message;
}


/* ============================================================
   USER INITIALIZATION
============================================================ */

async function initializeUser() {

  const {
    data: userData,
    error
  } =
    await db.auth.getUser();

  if (error || !userData.user) {

    await logout();

    return;
  }

  currentUser =
    userData.user;

  const {
    data: profileData,
    error: profileError
  } =
    await db
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

  if (profileError) {

    showAuth();

    setAuthMessage(
      profileError.message
    );

    return;
  }

  profile =
    profileData;

  if (
    profile.status !== "active"
  ) {

    await db.auth.signOut();

    showAuth();

    setAuthMessage(
      profile.status === "waitlist"
        ? "Your account is on the WAITLIST. An administrator must give you access."
        : "Your account has been blocked."
    );

    return;
  }

  renderUser();

  $("authScreen")
    .classList
    .add("hidden");

  $("app")
    .classList
    .remove("hidden");

  navigate("home");

  await loadTasks();

  if (profile.role === "admin") {
    await loadAdmin();
  }
}


/* ============================================================
   USER UI
============================================================ */

function renderUser() {

  const name =
    profile.full_name ||
    "User";

  const email =
    profile.email ||
    currentUser.email ||
    "";

  const initial =
    name
      .charAt(0)
      .toUpperCase();

  $("sidebarName")
    .textContent =
    name;

  $("sidebarRole")
    .textContent =
    capitalize(profile.role);

  $("sidebarAvatar")
    .textContent =
    initial;

  $("topUserName")
    .textContent =
    name;

  $("topUserEmail")
    .textContent =
    email;

  $("topAvatar")
    .textContent =
    initial;

  $("welcomeName")
    .textContent =
    name.split(" ")[0];

  $("workspaceUserBadge")
    .textContent =
    name;

  document
    .querySelectorAll(".admin-only")
    .forEach(el => {

      if (
        profile.role === "admin"
      ) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }

    });

  const notice =
    $("accessNotice");

  const access = [];

  if (profile.access_2d)
    access.push("2D");

  if (profile.access_3d)
    access.push("3D");

  if (access.length === 0) {

    notice.classList.remove("hidden");

    notice.textContent =
      "Your account is active, but no annotation task access has been assigned yet. Contact an administrator.";

  } else {

    notice.classList.add("hidden");
  }
}


/* ============================================================
   NAVIGATION
============================================================ */

function navigate(page) {

  const pages = {
    home: "homePage",
    tasks: "tasksPage",
    statistics: "statisticsPage",
    admin: "adminPage"
  };

  if (
    page === "admin" &&
    profile?.role !== "admin"
  ) {
    toast(
      "Administrator access required."
    );

    return;
  }

  Object.values(pages)
    .forEach(id => {

      $(id)
        .classList
        .add("hidden");

    });

  $(pages[page])
    .classList
    .remove("hidden");

  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });

  const titles = {
    home: "Workspace Overview",
    tasks: "My Work",
    statistics: "Performance",
    admin: "Admin Control Center"
  };

  $("pageTitle")
    .textContent =
    titles[page];
}


/* ============================================================
   CLOCK
============================================================ */

function updateClock() {

  const now =
    new Date();

  const hour =
    now.getHours();

  let greeting =
    "GOOD MORNING";

  if (hour >= 12)
    greeting =
      "GOOD AFTERNOON";

  if (hour >= 17)
    greeting =
      "GOOD EVENING";

  $("timeGreeting")
    .textContent =
    greeting;

  $("currentDay")
    .textContent =
    now.toLocaleDateString(
      undefined,
      {
        weekday: "long"
      }
    );

  $("currentDate")
    .textContent =
    now.toLocaleDateString(
      undefined,
      {
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    );
}


/* ============================================================
   TASKS
============================================================ */

async function loadTasks() {

  if (!profile)
    return;

  let query =
    db
      .from("tasks")
      .select(`
        *,
        assigned_profile:profiles!tasks_assigned_to_fkey(
          id,
          full_name,
          email
        ),
        claimed_profile:profiles!tasks_claimed_by_fkey(
          id,
          full_name,
          email
        )
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (
    profile.role !== "admin"
  ) {

    query =
      query.or(
        `assigned_to.eq.${currentUser.id},claimed_by.eq.${currentUser.id}`
      );
  }

  const {
    data,
    error
  } =
    await query;

  if (error) {

    toast(
      error.message
    );

    return;
  }

  const tasks =
    data || [];

  renderTaskCards(
    tasks,
    $("workGrid")
  );

  renderTaskCards(
    tasks,
    $("allTasksGrid")
  );

  updateStats(
    tasks
  );
}


function renderTaskCards(
  tasks,
  container
) {

  if (!container)
    return;

  container.innerHTML = "";

  if (!tasks.length) {

    container.innerHTML = `
      <div class="empty-work">
        <div>
          <strong>Working hard to give you more work.</strong>
          <span>
            No assigned tasks are currently waiting in your queue.
          </span>
        </div>
      </div>
    `;

    return;
  }

  tasks.forEach(task => {

    const hasAccess =
      task.task_type === "2d"
        ? profile.access_2d
        : profile.access_3d;

    const claimed =
      !!task.claimed_by;

    const owned =
      task.claimed_by ===
      currentUser.id;

    let buttonText =
      "Claim task";

    if (owned)
      buttonText =
      "Start task";

    if (
      claimed &&
      !owned
    )
      buttonText =
      "Already claimed";

    const card =
      document.createElement("div");

    card.className =
      "work-card";

    card.innerHTML = `

      <span class="task-type">
        ${task.task_type === "3d"
          ? "3D LIDAR"
          : "2D CAMERA"}
      </span>

      <h3>
        ${escapeHtml(task.name)}
      </h3>

      <p>
        ${escapeHtml(
          task.description ||
          "Annotation task ready for processing."
        )}
      </p>

      <div class="task-meta">

        <span class="meta-chip">
          ${task.status}
        </span>

        <span class="meta-chip">
          ${task.frame_count || 0} frames
        </span>

        <span class="meta-chip">
          ${task.task_type === "3d"
            ? "7 Cameras + LiDAR"
            : "2D Bounding Boxes"}
        </span>

      </div>

      <button
        class="claim-button"
        ${(
          !hasAccess ||
          (
            claimed &&
            !owned
          )
        ) ? "disabled" : ""}
        onclick="claimOrStartTask('${task.id}')"
      >
        ${
          hasAccess
            ? buttonText
            : "Access denied"
        }
      </button>
    `;

    container.appendChild(
      card
    );

  });
}


async function claimOrStartTask(
  taskId
) {

  const {
    data: task,
    error: claimError
  } =
    await db
      .rpc(
        "claim_task",
        {
          p_task_id:
            taskId
        }
      );

  if (claimError) {

    /*
     * It may already be owned by this user.
     * Try to load it and open it.
     */

    const {
      data: existing
    } =
      await db
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

    if (
      existing &&
      existing.claimed_by ===
      currentUser.id
    ) {

      openTaskWorkspace(
        existing
      );

      return;
    }

    toast(
      claimError.message
    );

    return;
  }

  await db
    .rpc(
      "start_task",
      {
        p_task_id:
          taskId
      }
    );

  openTaskWorkspace(
    task
  );

  await loadTasks();
}


/* ============================================================
   WORKSPACE ACCESS
============================================================ */

async function openTaskWorkspace(
  task
) {

  /*
   * Re-check permissions before opening.
   */

  const {
    data: allowed,
    error
  } =
    await db
      .rpc(
        "has_task_access",
        {
          p_task_id:
            task.id
        }
      );

  if (error || !allowed) {

    toast(
      "ACCESS DENIED — You do not have permission for this task."
    );

    return;
  }

  currentTask =
    task;

  currentFrameIndex =
    0;

  currentCamera =
    "Front Wide";

  $("workspace")
    .classList
    .remove("hidden");

  $("workspaceTaskName")
    .textContent =
    task.name;

  $("workspaceType")
    .textContent =
    task.task_type === "3d"
      ? "3D LIDAR TASK"
      : "2D CAMERA TASK";

  $("toolMode")
    .textContent =
    task.task_type === "3d"
      ? "3D MODE"
      : "2D MODE";

  $("cameraSelect")
    .value =
    currentCamera;

  $("cameraLockNotice")
    .classList.toggle(
      "hidden",
      task.task_type !== "3d"
    );

  await loadFrames();

  await loadAnnotations();

  updateWorkspaceStats();

  renderWorkspaceFrame();

  requestAnimationFrame(
    () => {
      renderLidar();
      renderCamera();
    }
  );
}


async function loadFrames() {

  const {
    data,
    error
  } =
    await db
      .from("frames")
      .select("*")
      .eq(
        "task_id",
        currentTask.id
      )
      .order(
        "frame_index",
        {
          ascending: true
        }
      );

  if (error) {

    toast(
      error.message
    );

    return;
  }

  currentFrames =
    data || [];

  const max =
    Math.max(
      0,
      currentFrames.length - 1
    );

  $("frameSlider")
    .max =
    max;

  $("frameSlider")
    .value =
    currentFrameIndex;
}


async function loadAnnotations() {

  const {
    data,
    error
  } =
    await db
      .from("annotations")
      .select("*")
      .eq(
        "task_id",
        currentTask.id
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (error) {

    toast(
      error.message
    );

    return;
  }

  annotations =
    data || [];
}


function closeWorkspace() {

  currentTask =
    null;

  currentFrames =
    [];

  annotations =
    [];

  $("workspace")
    .classList
    .add("hidden");
}


async function submitCurrentTask() {

  if (!currentTask)
    return;

  const confirmed =
    confirm(
      "Submit this task for review?"
    );

  if (!confirmed)
    return;

  const {
    error
  } =
    await db
      .rpc(
        "submit_task",
        {
          p_task_id:
            currentTask.id
        }
      );

  if (error) {

    toast(
      error.message
    );

    return;
  }

  toast(
    "Task submitted successfully."
  );

  closeWorkspace();

  await loadTasks();
}


/* ============================================================
   FRAME WORKFLOW
============================================================ */

function renderWorkspaceFrame() {

  $("frameNumber")
    .textContent =
    `Frame ${currentFrameIndex}`;

  const frame =
    currentFrames[
      currentFrameIndex
    ];

  $("frameTime")
    .textContent =
    `${Number(
      frame?.timestamp_seconds || 0
    ).toFixed(2)}s`;

  $("workspaceFrameCount")
    .textContent =
    currentFrames.length;

  renderLidar();

  renderCamera();
}


function previousFrame() {

  if (
    currentFrameIndex <= 0
  )
    return;

  currentFrameIndex--;

  $("frameSlider")
    .value =
    currentFrameIndex;

  renderWorkspaceFrame();
}


function nextFrame() {

  if (
    currentFrameIndex >=
    currentFrames.length - 1
  )
    return;

  currentFrameIndex++;

  $("frameSlider")
    .value =
    currentFrameIndex;

  renderWorkspaceFrame();
}


/* ============================================================
   LIDAR RENDERER
============================================================ */

function resizeCanvas(
  canvas
) {

  const rect =
    canvas.getBoundingClientRect();

  const ratio =
    window.devicePixelRatio ||
    1;

  canvas.width =
    Math.max(
      1,
      Math.floor(
        rect.width * ratio
      )
    );

  canvas.height =
    Math.max(
      1,
      Math.floor(
        rect.height * ratio
      )
    );

  const ctx =
    canvas.getContext("2d");

  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );

  return {
    width: rect.width,
    height: rect.height,
    ctx
  };
}


function renderLidar() {

  const canvas =
    $("lidarCanvas");

  if (
    !canvas ||
    canvas.offsetParent === null
  )
    return;

  const {
    width,
    height,
    ctx
  } =
    resizeCanvas(
      canvas
    );

  ctx.fillStyle =
    "#020306";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  drawLidarGround(
    ctx,
    width,
    height
  );

  drawLidarPoints(
    ctx,
    width,
    height
  );

  drawLidarObjects(
    ctx,
    width,
    height
  );

  drawLidarAxes(
    ctx,
    width,
    height
  );
}


function drawLidarGround(
  ctx,
  width,
  height
) {

  const cx =
    width * .5;

  const cy =
    height * .62;

  ctx.lineWidth =
    1;

  for (
    let r = 35;
    r < Math.max(width,height);
    r += 26
  ) {

    ctx.beginPath();

    ctx.ellipse(
      cx,
      cy,
      r * 1.5,
      r * .45,
      0,
      Math.PI,
      Math.PI * 2
    );

    ctx.strokeStyle =
      "rgba(38,99,235,.55)";

    ctx.stroke();
  }

  for (
    let angle = -Math.PI;
    angle <= 0;
    angle += Math.PI / 14
  ) {

    ctx.beginPath();

    ctx.moveTo(
      cx,
      cy
    );

    ctx.lineTo(
      cx +
        Math.cos(angle) *
        width,
      cy +
        Math.sin(angle) *
        height
    );

    ctx.strokeStyle =
      "rgba(38,99,235,.13)";

    ctx.stroke();
  }
}


function drawLidarPoints(
  ctx,
  width,
  height
) {

  const seed =
    currentFrameIndex * 17;

  for (
    let i = 0;
    i < 1800;
    i++
  ) {

    const pseudo =
      Math.sin(
        i * 12.9898 +
        seed
      ) * 43758.5453;

    const random =
      pseudo -
      Math.floor(pseudo);

    const x =
      random * width;

    const road =
      height * .56 +
      Math.sin(
        x * .012
      ) * 20;

    const spread =
      Math.abs(
        x - width / 2
      ) / width;

    const y =
      road +
      (
        Math.sin(
          i * .71
        ) *
        70 *
        spread
      );

    if (
      y < height * .25 ||
      y > height * .87
    )
      continue;

    ctx.fillStyle =
      i % 5 === 0
        ? "rgba(250,204,21,.75)"
        : "rgba(53,227,139,.7)";

    const size =
      i % 7 === 0
        ? 2
        : 1;

    ctx.fillRect(
      x,
      y,
      size,
      size
    );
  }
}


function drawLidarObjects(
  ctx,
  width,
  height
) {

  const objects = [
    {
      x: .23,
      y: .55,
      w: .12,
      h: .09,
      color: "#facc15"
    },
    {
      x: .43,
      y: .48,
      w: .10,
      h: .08,
      color: "#e5e7eb"
    },
    {
      x: .57,
      y: .43,
      w: .08,
      h: .07,
      color: "#e5e7eb"
    },
    {
      x: .72,
      y: .54,
      w: .13,
      h: .08,
      color: "#35e38b"
    }
  ];

  objects.forEach(
    o => {

      const x =
        width * o.x;

      const y =
        height * o.y;

      const w =
        width * o.w;

      const h =
        height * o.h;

      ctx.strokeStyle =
        o.color;

      ctx.lineWidth = 1.2;

      ctx.strokeRect(
        x,
        y,
        w,
        h
      );

      ctx.beginPath();

      ctx.moveTo(
        x + w / 2,
        y
      );

      ctx.lineTo(
        x + w / 2,
        y - 20
      );

      ctx.stroke();

      ctx.beginPath();

      ctx.moveTo(
        x + w / 2,
        y - 20
      );

      ctx.lineTo(
        x + w / 2 - 5,
        y - 12
      );

      ctx.lineTo(
        x + w / 2 + 5,
        y - 12
      );

      ctx.closePath();

      ctx.fillStyle =
        o.color;

      ctx.fill();
    }
  );
}


function drawLidarAxes(
  ctx,
  width,
  height
) {

  const x =
    width - 55;

  const y =
    height - 45;

  ctx.lineWidth = 2;

  ctx.strokeStyle =
    "#ef4444";

  ctx.beginPath();

  ctx.moveTo(x,y);

  ctx.lineTo(
    x + 20,
    y
  );

  ctx.stroke();

  ctx.strokeStyle =
    "#22c55e";

  ctx.beginPath();

  ctx.moveTo(x,y);

  ctx.lineTo(
    x,
    y - 20
  );

  ctx.stroke();

  ctx.fillStyle =
    "#60a5fa";

  ctx.font =
    "9px monospace";

  ctx.fillText(
    "X",
    x + 22,
    y + 3
  );

  ctx.fillText(
    "Z",
    x - 4,
    y - 24
  );
}


/* ============================================================
   3D LIDAR DRAWING
============================================================ */

function lidarMouseDown(e) {

  if (
    !drawingMode ||
    currentTask?.task_type !== "3d"
  )
    return;

  const rect =
    e.target.getBoundingClientRect();

  drawStart = {
    x:
      e.clientX -
      rect.left,

    y:
      e.clientY -
      rect.top
  };

  drawing = true;
}


function lidarMouseMove(e) {

  if (
    !drawing ||
    !drawStart
  )
    return;

  renderLidar();

  const rect =
    e.target.getBoundingClientRect();

  const x =
    e.clientX -
    rect.left;

  const y =
    e.clientY -
    rect.top;

  const ctx =
    e.target.getContext("2d");

  ctx.strokeStyle =
    "#a78bfa";

  ctx.lineWidth = 2;

  ctx.strokeRect(
    drawStart.x,
    drawStart.y,
    x - drawStart.x,
    y - drawStart.y
  );
}


async function lidarMouseUp(e) {

  if (
    !drawing ||
    !drawStart
  )
    return;

  drawing = false;

  const rect =
    e.target.getBoundingClientRect();

  const end = {
    x:
      e.clientX -
      rect.left,

    y:
      e.clientY -
      rect.top
  };

  const x =
    Math.min(
      drawStart.x,
      end.x
    );

  const y =
    Math.min(
      drawStart.y,
      end.y
    );

  const width =
    Math.abs(
      end.x -
      drawStart.x
    );

  const height =
    Math.abs(
      end.y -
      drawStart.y
    );

  drawStart = null;

  if (
    width < 15 ||
    height < 15
  ) {

    drawingMode = false;

    return;
  }

  await save3DAnnotation(
    x,
    y,
    width,
    height,
    e.target.width,
    e.target.height
  );

  drawingMode = false;
}


async function save3DAnnotation(
  x,
  y,
  width,
  height,
  canvasWidth,
  canvasHeight
) {

  const frame =
    currentFrames[
      currentFrameIndex
    ];

  if (!frame)
    return;

  const label =
    $("labelSelect")
      .value;

  const trackId =
    $("trackId")
      .value
      .trim() ||
    `TRACK_${Date.now()}`;

  /*
   * The browser workspace stores normalized
   * 3D projection values. A production calibrated
   * renderer can replace these with actual sensor
   * coordinates.
   */

  const normalized = {
    x:
      x / canvasWidth,

    y:
      y / canvasHeight,

    width:
      width / canvasWidth,

    height:
      height / canvasHeight
  };

  const {
    data,
    error
  } =
    await db
      .from("annotations")
      .insert({
        task_id:
          currentTask.id,

        frame_id:
          frame.id,

        user_id:
          currentUser.id,

        track_id:
          trackId,

        label,

        camera_name:
          currentCamera,

        x3d:
          normalized.x,

        y3d:
          normalized.y,

        z3d:
          0,

        length3d:
          normalized.width,

        width3d:
          normalized.width * .55,

        height3d:
          normalized.height,

        yaw:
          0,

        source:
          "3d",

        generated_to_2d:
          false,

        attributes: {
          ground_contact: true,
          tight_fit: true,
          cross_camera_track: true
        }
      })
      .select()
      .single();

  if (error) {

    toast(
      error.message
    );

    return;
  }

  annotations.push(
    data
  );

  await db.rpc(
    "recalculate_user_box_counts",
    {
      p_user_id:
        currentUser.id
    }
  );

  updateWorkspaceStats();

  toast(
    "3D cuboid saved."
  );

  renderLidar();

  renderCamera();
}


/* ============================================================
   CAMERA RENDERER
============================================================ */

function renderCamera() {

  const canvas =
    $("cameraCanvas");

  if (
    !canvas ||
    canvas.offsetParent === null
  )
    return;

  const {
    width,
    height,
    ctx
  } =
    resizeCanvas(
      canvas
    );

  ctx.fillStyle =
    "#15181e";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  drawCameraRoad(
    ctx,
    width,
    height
  );

  drawCameraObjects(
    ctx,
    width,
    height
  );

  drawCameraAnnotations(
    ctx,
    width,
    height
  );
}


function drawCameraRoad(
  ctx,
  width,
  height
) {

  const sky =
    ctx.createLinearGradient(
      0,
      0,
      0,
      height
    );

  sky.addColorStop(
    0,
    "#3b414b"
  );

  sky.addColorStop(
    .45,
    "#20252d"
  );

  sky.addColorStop(
    1,
    "#0b0d11"
  );

  ctx.fillStyle =
    sky;

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  ctx.fillStyle =
    "#242a32";

  ctx.beginPath();

  ctx.moveTo(
    0,
    height * .52
  );

  ctx.lineTo(
    width,
    height * .42
  );

  ctx.lineTo(
    width,
    height
  );

  ctx.lineTo(
    0,
    height
  );

  ctx.closePath();

  ctx.fill();

  ctx.strokeStyle =
    "rgba(255,255,255,.45)";

  ctx.lineWidth = 2;

  ctx.beginPath();

  ctx.moveTo(
    width * .42,
    height
  );

  ctx.lineTo(
    width * .48,
    height * .46
  );

  ctx.stroke();

  ctx.beginPath();

  ctx.moveTo(
    width * .75,
    height
  );

  ctx.lineTo(
    width * .58,
    height * .46
  );

  ctx.stroke();

  ctx.strokeStyle =
    "rgba(139,92,246,.3)";

  for (
    let i = 0;
    i < 7;
    i++
  ) {

    ctx.beginPath();

    ctx.moveTo(
      width * .1,
      height *
        (.58 + i * .055)
    );

    ctx.lineTo(
      width * .9,
      height *
        (.52 + i * .055)
    );

    ctx.stroke();
  }

  /*
   * Camera labels
   */

  ctx.fillStyle =
    "rgba(0,0,0,.45)";

  ctx.fillRect(
    12,
    12,
    130,
    25
  );

  ctx.fillStyle =
    "#dbe0e9";

  ctx.font =
    "10px Inter, Arial";

  ctx.fillText(
    currentCamera,
    21,
    29
  );
}


function drawCameraObjects(
  ctx,
  width,
  height
) {

  const objects = [
    {
      x: .18,
      y: .48,
      w: .12,
      h: .16,
      color: "#34d399"
    },
    {
      x: .38,
      y: .43,
      w: .15,
      h: .19,
      color: "#34d399"
    },
    {
      x: .61,
      y: .53,
      w: .12,
      h: .14,
      color: "#34d399"
    },
    {
      x: .76,
      y: .45,
      w: .13,
      h: .17,
      color: "#34d399"
    }
  ];

  objects.forEach(
    o => {

      const x =
        width * o.x;

      const y =
        height * o.y;

      const w =
        width * o.w;

      const h =
        height * o.h;

      ctx.fillStyle =
        "rgba(10,12,15,.85)";

      ctx.fillRect(
        x,
        y,
        w,
        h
      );

      ctx.strokeStyle =
        "rgba(255,255,255,.25)";

      ctx.strokeRect(
        x,
        y,
        w,
        h
      );

      ctx.fillStyle =
        "rgba(255,255,255,.08)";

      ctx.fillRect(
        x + w * .15,
        y + h * .15,
        w * .7,
        h * .2
      );
    }
  );
}


function drawCameraAnnotations(
  ctx,
  width,
  height
) {

  const frame =
    currentFrames[
      currentFrameIndex
    ];

  if (!frame)
    return;

  const current =
    annotations.filter(
      a =>
        a.frame_id === frame.id &&
        (
          a.camera_name === currentCamera ||
          !a.camera_name
        )
    );

  current.forEach(
    a => {

      let x;
      let y;
      let w;
      let h;

      /*
       * 2D manual annotation
       */

      if (
        a.source === "2d"
      ) {

        x =
          Number(a.x) * width;

        y =
          Number(a.y) * height;

        w =
          Number(a.width) * width;

        h =
          Number(a.height) * height;
      }

      /*
       * 3D projected annotation
       */

      else {

        x =
          Number(a.x3d || .3) *
          width;

        y =
          Number(a.y3d || .35) *
          height;

        w =
          Number(a.length3d || .12) *
          width;

        h =
          Number(a.height3d || .15) *
          height;
      }

      const generated =
        a.generated_to_2d;

      const locked =
        currentTask.task_type === "3d" ||
        a.source === "3d";

      ctx.strokeStyle =
        generated
          ? "#a78bfa"
          : locked
            ? "#facc15"
            : "#35e38b";

      ctx.lineWidth =
        2;

      ctx.strokeRect(
        x,
        y,
        w,
        h
      );

      ctx.fillStyle =
        ctx.strokeStyle;

      ctx.font =
        "9px monospace";

      ctx.fillText(
        `${a.label} | ${a.track_id || "NO-ID"}`,
        x,
        Math.max(
          12,
          y - 5
        )
      );

      /*
       * Heading arrow
       */

      ctx.beginPath();

      ctx.moveTo(
        x + w / 2,
        y
      );

      ctx.lineTo(
        x + w / 2,
        y - 18
      );

      ctx.stroke();

      ctx.beginPath();

      ctx.moveTo(
        x + w / 2,
        y - 18
      );

      ctx.lineTo(
        x + w / 2 - 4,
        y - 11
      );

      ctx.lineTo(
        x + w / 2 + 4,
        y - 11
      );

      ctx.closePath();

      ctx.fill();
    }
  );
}


/* ============================================================
   2D DRAWING
============================================================ */

function cameraMouseDown(e) {

  /*
   * 3D users cannot modify 2D projected boxes.
   */

  if (
    currentTask?.task_type === "3d"
  ) {

    toast(
      "3D users cannot adjust projected 2D boxes."
    );

    return;
  }

  if (!drawingMode)
    return;

  const rect =
    e.target.getBoundingClientRect();

  drawStart = {
    x:
      e.clientX -
      rect.left,

    y:
      e.clientY -
      rect.top
  };

  drawing = true;
}


function cameraMouseMove(e) {

  if (
    !drawing ||
    !drawStart
  )
    return;

  renderCamera();

  const rect =
    e.target.getBoundingClientRect();

  const x =
    e.clientX -
    rect.left;

  const y =
    e.clientY -
    rect.top;

  const ctx =
    e.target.getContext("2d");

  ctx.strokeStyle =
    "#35e38b";

  ctx.lineWidth = 2;

  ctx.strokeRect(
    drawStart.x,
    drawStart.y,
    x - drawStart.x,
    y - drawStart.y
  );
}


async function cameraMouseUp(e) {

  if (
    !drawing ||
    !drawStart
  )
    return;

  drawing = false;

  const rect =
    e.target.getBoundingClientRect();

  const end = {
    x:
      e.clientX -
      rect.left,

    y:
      e.clientY -
      rect.top
  };

  const x =
    Math.min(
      drawStart.x,
      end.x
    );

  const y =
    Math.min(
      drawStart.y,
      end.y
    );

  const width =
    Math.abs(
      end.x -
      drawStart.x
    );

  const height =
    Math.abs(
      end.y -
      drawStart.y
    );

  drawStart = null;

  drawingMode = false;

  if (
    width < 10 ||
    height < 10
  )
    return;

  const frame =
    currentFrames[
      currentFrameIndex
    ];

  if (!frame)
    return;

  const canvas =
    e.target;

  const rect2 =
    canvas.getBoundingClientRect();

  const label =
    $("labelSelect")
      .value;

  const trackId =
    $("trackId")
      .value
      .trim() ||
    `TRACK_${Date.now()}`;

  const {
    data,
    error
  } =
    await db
      .from("annotations")
      .insert({
        task_id:
          currentTask.id,

        frame_id:
          frame.id,

        user_id:
          currentUser.id,

        track_id:
          trackId,

        label,

        camera_name:
          currentCamera,

        x:
          x / rect2.width,

        y:
          y / rect2.height,

        width:
          width / rect2.width,

        height:
          height / rect2.height,

        source:
          "2d",

        generated_to_2d:
          false,

        attributes: {
          pixel_tight: true
        }
      })
      .select()
      .single();

  if (error) {

    toast(
      error.message
    );

    return;
  }

  annotations.push(
    data
  );

  await db.rpc(
    "recalculate_user_box_counts",
    {
      p_user_id:
        currentUser.id
    }
  );

  updateWorkspaceStats();

  renderCamera();

  toast(
    "2D box saved."
  );
}


/* ============================================================
   DRAWING BUTTON
============================================================ */

function enableDrawing() {

  if (
    currentTask.task_type === "3d"
  ) {

    drawingMode = true;

    toast(
      "Draw a cuboid on the LiDAR panel."
    );

    return;
  }

  drawingMode = true;

  toast(
    "Drag around an object in the 2D camera."
  );
}


/* ============================================================
   GENERATE 2D FROM 3D
============================================================ */

async function generate2DBoxes() {

  if (
    currentTask?.task_type !== "3d"
  ) {

    toast(
      "Generate Box to 2D is available for 3D tasks."
    );

    return;
  }

  const frame =
    currentFrames[
      currentFrameIndex
    ];

  if (!frame)
    return;

  const source3D =
    annotations.filter(
      a =>
        a.frame_id === frame.id &&
        (
          a.source === "3d" ||
          a.source === "manual-3d"
        ) &&
        !a.generated_to_2d
    );

  if (!source3D.length) {

    toast(
      "Create at least one 3D cuboid first."
    );

    return;
  }

  let generated =
    0;

  for (
    const box of source3D
  ) {

    const {
      data,
      error
    } =
      await db
        .from("annotations")
        .insert({
          task_id:
            currentTask.id,

          frame_id:
            frame.id,

          user_id:
            currentUser.id,

          track_id:
            box.track_id,

          label:
            box.label,

          camera_name:
            currentCamera,

          x:
            Number(
              box.x3d || .3
            ),

          y:
            Number(
              box.y3d || .3
            ),

          width:
            Number(
              box.length3d || .12
            ),

          height:
            Number(
              box.height3d || .15
            ),

          x3d:
            box.x3d,

          y3d:
            box.y3d,

          z3d:
            box.z3d,

          length3d:
            box.length3d,

          width3d:
            box.width3d,

          height3d:
            box.height3d,

          yaw:
            box.yaw,

          source:
            "3d",

          generated_to_2d:
            true,

          attributes: {
            projected_from_3d: true,
            locked_for_3d_user: true,
            global_track_id:
              box.track_id
          }
        })
        .select()
        .single();

    if (!error) {

      annotations.push(
        data
      );

      generated++;
    }
  }

  await db.rpc(
    "recalculate_user_box_counts",
    {
      p_user_id:
        currentUser.id
    }
  );

  updateWorkspaceStats();

  renderCamera();

  toast(
    `${generated} 3D box(es) generated to 2D.`
  );
}


/* ============================================================
   WORKSPACE STATS
============================================================ */

function updateWorkspaceStats() {

  const mine =
    annotations.filter(
      a =>
        a.user_id ===
        currentUser.id
    );

  const threeD =
    mine.filter(
      a =>
        a.source === "3d" ||
        a.source === "manual-3d"
    );

  const twoD =
    mine.filter(
      a =>
        a.source === "2d" ||
        a.generated_to_2d
    );

  $("workspace3dCount")
    .textContent =
    threeD.length;

  $("workspace2dCount")
    .textContent =
    twoD.length;
}


function updateStats(tasks) {

  $("stat2d")
    .textContent =
    profile.total_boxes_2d || 0;

  $("stat3d")
    .textContent =
    profile.total_boxes_3d || 0;

  $("statTasks")
    .textContent =
    tasks.length;

  $("statRole")
    .textContent =
    capitalize(profile.role);
}


/* ============================================================
   ADMIN
============================================================ */

async function loadAdmin() {

  if (
    profile?.role !== "admin"
  )
    return;

  await loadAdminUsers();

  await loadAdminTasks();

  await loadAssigneeDropdown();
}


async function loadAdminUsers() {

  const {
    data,
    error
  } =
    await db
      .from("profiles")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {

    toast(
      error.message
    );

    return;
  }

  const container =
    $("usersTable");

  container.innerHTML = "";

  if (!data.length) {

    container.innerHTML =
      `<div class="empty-work">
        No users yet.
      </div>`;

    return;
  }

  data.forEach(
    user => {

      const row =
        document.createElement("div");

      row.className =
        "user-row";

      row.innerHTML = `

        <div>
          <strong>
            ${escapeHtml(
              user.full_name
            )}
          </strong>

          <div class="user-email">
            ${escapeHtml(
              user.email
            )}
          </div>
        </div>

        <div>
          <select
            class="mini-select"
            onchange="changeUserRole('${user.id}', this.value)"
          >
            <option
              value="coworker"
              ${user.role === "coworker" ? "selected" : ""}
            >
              Coworker
            </option>

            <option
              value="reviewer"
              ${user.role === "reviewer" ? "selected" : ""}
            >
              Reviewer
            </option>

            <option
              value="admin"
              ${user.role === "admin" ? "selected" : ""}
            >
              Admin
            </option>
          </select>
        </div>

        <div>

          <select
            class="mini-select"
            onchange="changeUserStatus('${user.id}', this.value)"
          >

            <option
              value="waitlist"
              ${user.status === "waitlist" ? "selected" : ""}
            >
              Waitlist
            </option>

            <option
              value="active"
              ${user.status === "active" ? "selected" : ""}
            >
              Active
            </option>

            <option
              value="blocked"
              ${user.status === "blocked" ? "selected" : ""}
            >
              Blocked
            </option>

          </select>

        </div>

        <div class="user-controls">

          <label class="access-toggle">

            <input
              type="checkbox"
              ${user.access_2d ? "checked" : ""}
              onchange="changeUserAccess('${user.id}','access_2d',this.checked)"
            >

            2D

          </label>


          <label class="access-toggle">

            <input
              type="checkbox"
              ${user.access_3d ? "checked" : ""}
              onchange="changeUserAccess('${user.id}','access_3d',this.checked)"
            >

            3D

          </label>

        </div>
      `;

      container.appendChild(
        row
      );

    }
  );
}


async function changeUserRole(
  userId,
  role
) {

  const {
    error
  } =
    await db
      .from("profiles")
      .update({
        role
      })
      .eq(
        "id",
        userId
      );

  if (error) {

    toast(
      error.message
    );

    return;
  }

  toast(
    "User role updated."
  );

  await loadAdminUsers();
}


async function changeUserStatus(
  userId,
  status
) {

  const {
    error
  } =
    await db
      .from("profiles")
      .update({
        status
      })
      .eq(
        "id",
        userId
      );

  if (error) {

    toast(
      error.message
    );

    return;
  }

  toast(
    `User status changed to ${status}.`
  );

  await loadAdminUsers();
}


async function changeUserAccess(
  userId,
  field,
  value
) {

  const patch = {};

  patch[field] =
    value;

  const {
    error
  } =
    await db
      .from("profiles")
      .update(
        patch
      )
      .eq(
        "id",
        userId
      );

  if (error) {

    toast(
      error.message
    );

    return;
  }

  toast(
    "Access updated."
  );
}


async function loadAssigneeDropdown() {

  const {
    data,
    error
  } =
    await db
      .from("profiles")
      .select(
        "id,full_name,email,status,access_2d,access_3d"
      )
      .eq(
        "status",
        "active"
      )
      .order(
        "full_name"
      );

  if (error)
    return;

  const select =
    $("taskAssignee");

  select.innerHTML =
    `<option value="">
      Unassigned
    </option>`;

  data.forEach(
    user => {

      const option =
        document.createElement("option");

      option.value =
        user.id;

      option.textContent =
        `${user.full_name} — ${user.email}`;

      select.appendChild(
        option
      );
    }
  );
}


/* ============================================================
   ADMIN TASK CREATION
============================================================ */

async function createTask(e) {

  e.preventDefault();

  const name =
    $("taskName")
      .value
      .trim();

  const description =
    $("taskDescription")
      .value
      .trim();

  const taskType =
    $("taskType")
      .value;

  const assignedTo =
    $("taskAssignee")
      .value || null;

  const interval =
    Number(
      $("frameInterval")
        .value
    ) || .5;

  const video =
    $("taskVideo")
      .files[0];

  $("taskCreateMessage")
    .textContent =
    "Creating task...";

  const {
    data: task,
    error
  } =
    await db
      .from("tasks")
      .insert({
        name,
        description,
        task_type:
          taskType,

        assigned_to:
          assignedTo,

        status:
          assignedTo
            ? "assigned"
            : "unassigned",

        frame_interval:
          interval,

        created_by:
          currentUser.id,

        video_name:
          video?.name ||
          null
      })
      .select()
      .single();

  if (error) {

    $("taskCreateMessage")
      .textContent =
      error.message;

    return;
  }

  if (video) {

    $("taskCreateMessage")
      .textContent =
      "Extracting video frames...";

    await extractAndUploadFrames(
      task,
      video,
      interval
    );
  }

  $("taskCreateMessage")
    .textContent =
    "Task created successfully.";

  $("createTaskForm")
    .reset();

  await loadTasks();

  await loadAdmin();
}


async function extractAndUploadFrames(
  task,
  videoFile,
  interval
) {

  const video =
    document.createElement("video");

  video.muted =
    true;

  video.playsInline =
    true;

  video.preload =
    "metadata";

  const objectUrl =
    URL.createObjectURL(
      videoFile
    );

  video.src =
    objectUrl;

  await new Promise(
    (resolve,reject) => {

      video.onloadedmetadata =
        resolve;

      video.onerror =
        reject;
    }
  );

  const duration =
    video.duration;

  const canvas =
    document.createElement("canvas");

  canvas.width =
    video.videoWidth || 1280;

  canvas.height =
    video.videoHeight || 720;

  const ctx =
    canvas.getContext("2d");

  let frameIndex = 0;

  /*
   * Browser extraction.
   *
   * For large production datasets,
   * move this process to a worker/backend.
   */

  for (
    let time = 0;
    time < duration;
    time += interval
  ) {

    await seekVideo(
      video,
      time
    );

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob =
      await canvasToBlob(
        canvas
      );

    const path =
      `${task.id}/Front-Wide/${frameIndex}.jpg`;

    const {
      error: uploadError
    } =
      await db
        .storage
        .from("task-media")
        .upload(
          path,
          blob,
          {
            contentType:
              "image/jpeg",

            upsert:
              true
          }
        );

    if (uploadError) {

      console.error(
        uploadError
      );

      continue;
    }

    const {
      error: frameError
    } =
      await db
        .from("frames")
        .insert({
          task_id:
            task.id,

          frame_index:
            frameIndex,

          timestamp_seconds:
            time,

          camera_name:
            "Front Wide",

          storage_path:
            path,

          width:
            canvas.width,

          height:
            canvas.height
        });

    if (frameError) {

      console.error(
        frameError
      );
    }

    frameIndex++;

    /*
     * Yield to the browser so the UI remains responsive.
     */

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          1
        )
    );
  }

  await db
    .from("tasks")
    .update({
      frame_count:
        frameIndex
    })
    .eq(
      "id",
      task.id
    );

  URL.revokeObjectURL(
    objectUrl
  );
}


function seekVideo(
  video,
  time
) {

  return new Promise(
    resolve => {

      const handler =
        () => {

          video.removeEventListener(
            "seeked",
            handler
          );

          resolve();
        };

      video.addEventListener(
        "seeked",
        handler
      );

      video.currentTime =
        Math.min(
          time,
          video.duration
        );
    }
  );
}


function canvasToBlob(
  canvas
) {

  return new Promise(
    resolve => {

      canvas.toBlob(
        blob =>
          resolve(blob),
        "image/jpeg",
        .82
      );

    }
  );
}


/* ============================================================
   ADMIN TASK TABLE
============================================================ */

async function loadAdminTasks() {

  const {
    data,
    error
  } =
    await db
      .from("tasks")
      .select(`
        *,
        assigned_profile:profiles!tasks_assigned_to_fkey(
          full_name,
          email
        ),
        claimed_profile:profiles!tasks_claimed_by_fkey(
          full_name,
          email
        )
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {

    toast(
      error.message
    );

    return;
  }

  const container =
    $("adminTasksTable");

  container.innerHTML = "";

  data.forEach(
    task => {

      const row =
        document.createElement("div");

      row.className =
        "user-row";

      row.innerHTML = `

        <div>

          <strong>
            ${escapeHtml(
              task.name
            )}
          </strong>

          <div class="user-email">
            ${task.task_type.toUpperCase()}
          </div>

        </div>

        <div>
          ${task.status}
        </div>

        <div>
          ${
            task.assigned_profile
              ?.full_name ||
            "Unassigned"
          }
        </div>

        <div class="user-controls">

          <select
            class="mini-select"
            onchange="assignTask('${task.id}', this.value)"
          >

            <option value="">
              Unassigned
            </option>

          </select>

          <button
            class="mini-button"
            onclick="adminOpenTask('${task.id}')"
          >
            Open
          </button>

        </div>
      `;

      container.appendChild(
        row
      );

      populateTaskAssigneeSelect(
        row.querySelector("select"),
        task
      );

    }
  );
}


async function populateTaskAssigneeSelect(
  select,
  task
) {

  const {
    data
  } =
    await db
      .from("profiles")
      .select(
        "id,full_name,email"
      )
      .eq(
        "status",
        "active"
      )
      .order(
        "full_name"
      );

  data?.forEach(
    user => {

      const option =
        document.createElement("option");

      option.value =
        user.id;

      option.textContent =
        user.full_name;

      if (
        user.id ===
        task.assigned_to
      ) {
        option.selected =
          true;
      }

      select.appendChild(
        option
      );

    }
  );
}


async function assignTask(
  taskId,
  userId
) {

  const patch = {
    assigned_to:
      userId || null,

    status:
      userId
        ? "assigned"
        : "unassigned"
  };

  const {
    error
  } =
    await db
      .from("tasks")
      .update(patch)
      .eq(
        "id",
        taskId
      );

  if (error) {

    toast(
      error.message
    );

    return;
  }

  toast(
    "Task assignment updated."
  );

  await loadAdminTasks();

  await loadTasks();
}


async function adminOpenTask(
  taskId
) {

  const {
    data,
    error
  } =
    await db
      .from("tasks")
      .select("*")
      .eq(
        "id",
        taskId
      )
      .single();

  if (error) {

    toast(
      error.message
    );

    return;
  }

  /*
   * Admin is allowed to inspect the task.
   */

  openTaskWorkspace(
    data
  );
}


/* ============================================================
   MODAL
============================================================ */

function openModal(
  html
) {

  $("modalContent")
    .innerHTML =
    html;

  $("modal")
    .classList
    .remove("hidden");
}


function closeModal() {

  $("modal")
    .classList
    .add("hidden");
}


/* ============================================================
   TOAST
============================================================ */

let toastTimer = null;

function toast(message) {

  const element =
    $("toast");

  element.textContent =
    message;

  element.classList
    .add("show");

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(
      () => {
        element.classList
          .remove("show");
      },
      3500
    );
}


/* ============================================================
   UTILITIES
============================================================ */

function capitalize(
  value
) {

  if (!value)
    return "";

  return value
    .charAt(0)
    .toUpperCase() +
    value.slice(1);
}


function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


/* ============================================================
   PASSWORD RECOVERY
============================================================ */

db.auth.onAuthStateChange(
  async event => {

    if (
      event ===
      "PASSWORD_RECOVERY"
    ) {

      openModal(`
        <h3>Set new password</h3>

        <p>
          Enter your new AI TRAINER EXPERT password.
        </p>

        <input
          id="newPassword"
          type="password"
          placeholder="New password"
          style="margin-bottom:12px"
        >

        <button
          class="primary-button full"
          onclick="updatePassword()"
        >
          Update password
        </button>

        <div
          id="passwordMessage"
          class="message"
        ></div>
      `);

    }

  }
);


async function updatePassword() {

  const password =
    $("newPassword")
      .value;

  if (
    password.length < 6
  ) {

    $("passwordMessage")
      .textContent =
      "Password must contain at least 6 characters.";

    return;
  }

  const {
    error
  } =
    await db.auth
      .updateUser({
        password
      });

  if (error) {

    $("passwordMessage")
      .textContent =
      error.message;

    return;
  }

  $("passwordMessage")
    .textContent =
    "Password updated successfully.";

  setTimeout(
    closeModal,
    1200
  );
}
