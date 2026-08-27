const supabaseClient = window.supabase.createClient(
  window.ATE_CONFIG.SUPABASE_URL,
  window.ATE_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function greeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function taskUrl(task, mode) {
  return `workspace.html?task=${encodeURIComponent(task.id)}&mode=${mode}`;
}

async function loadProfile(user) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  return data;
}

async function loadTasks() {

  const { data: tasks, error } = await supabaseClient
    .from("tasks")
    .select(`
      id,
      name,
      task_type,
      status,
      description,
      frame_count,
      fps,
      created_at,
      task_assignments(
        id,
        user_id,
        status,
        claimed_at
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);

    $("taskList").innerHTML = `
      <div class="empty-work">
        <div>
          <strong>Unable to load work</strong>
          <span>${escapeHtml(error.message)}</span>
        </div>
      </div>
    `;

    return;
  }

  const visible = tasks || [];

  if (!visible.length) {
    $("taskList").innerHTML = `
      <div class="empty-work">
        <div>
          <strong>Working hard to give you more work.</strong>
          <span>There are no available assignments right now.</span>
        </div>
      </div>
    `;

    return;
  }

  $("taskList").innerHTML = visible.map(task => {

    const assignment =
      (task.task_assignments || [])
      .find(a => a.user_id === currentUser.id);

    const assignedToMe = !!assignment;

    const mode = task.task_type;

    let action = "";

    if (assignedToMe) {

      const buttonText =
        assignment.status === "in_progress"
          ? "Continue task"
          : "Start task";

      action = `
        <button
          onclick="openTask('${task.id}','${mode}')">
          ${buttonText}
        </button>
      `;

    } else if (task.status === "open") {

      action = `
        <button
          onclick="claimTask('${task.id}')">
          Claim task
        </button>
      `;

    }

    return `
      <article class="task-card ${assignedToMe ? "assigned" : ""}">

        <h3>${escapeHtml(task.name)}</h3>

        <div class="task-meta">

          <span>
            ${task.task_type === "3d" ? "3D LiDAR" : "2D Camera"}
          </span>

          <span>
            ${escapeHtml(task.status)}
          </span>

          ${
            task.frame_count
              ? `<span>${task.frame_count} frames</span>`
              : ""
          }

          ${
            task.fps
              ? `<span>${task.fps} FPS</span>`
              : ""
          }

        </div>

        ${
          task.description
            ? `<p style="color:var(--muted);font-size:12px;">
                ${escapeHtml(task.description)}
              </p>`
            : ""
        }

        <div class="task-actions">
          ${action}
        </div>

      </article>
    `;

  }).join("");
}

async function claimTask(taskId) {

  const { data, error } =
    await supabaseClient.rpc(
      "claim_task",
      {
        p_task_id: taskId
      }
    );

  if (error) {
    alert(error.message);
    await loadTasks();
    return;
  }

  openTask(
    taskId,
    data?.task_type || "2d"
  );
}

async function openTask(taskId, mode) {

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("id,task_type")
    .eq("id", taskId)
    .maybeSingle();

  if (error || !data) {
    alert(
      "Access denied. You do not have permission for this task."
    );
    return;
  }

  if (data.task_type !== mode) {
    mode = data.task_type;
  }

  window.location.href = taskUrl(data, mode);
}

async function initialise() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return;
  }

  currentUser = session.user;

  try {
    currentProfile = await loadProfile(currentUser);
  } catch (error) {
    console.error(error);
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
    return;
  }

  if (
    currentProfile.status !== "active"
  ) {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
    return;
  }

  $("greetingWord").textContent = greeting();

  $("userName").textContent =
    currentProfile.full_name || "Annotator";

  $("topUserName").textContent =
    currentProfile.full_name || "Annotator";

  $("topUserRole").textContent =
    currentProfile.role;

  $("avatar").textContent =
    (currentProfile.full_name || "A")
      .charAt(0)
      .toUpperCase();

  $("accessRole").textContent =
    currentProfile.role;

  $("access2d").textContent =
    currentProfile.access_2d ? "Enabled" : "Disabled";

  $("access3d").textContent =
    currentProfile.access_3d ? "Enabled" : "Disabled";

  $("accountStatus").textContent =
    currentProfile.status;

  if (currentProfile.role === "admin") {
    $("adminButton").classList.remove("hidden");

    $("adminButton").onclick = () => {
      window.location.href = "admin.html";
    };
  }

  $("logoutButton").onclick = async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  };

  await loadTasks();
}

window.claimTask = claimTask;
window.openTask = openTask;

initialise();
