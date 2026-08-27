const supabaseClient = window.supabase.createClient(
  window.ATE_CONFIG.SUPABASE_URL,
  window.ATE_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const $ = id => document.getElementById(id);

let currentUser;
let currentProfile;

let allUsers = [];
let allTasks = [];

function msg(id, text, type = "") {

  const el = $(id);

  el.textContent = text;
  el.className = "status-message";

  if (type) {
    el.classList.add(type);
  }

  el.classList.remove("hidden");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadUsers() {

  const { data, error } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .order("created_at", {
        ascending: false
      });

  if (error) {
    msg("inviteMessage", error.message, "error");
    return;
  }

  allUsers = data || [];

  $("usersTable").innerHTML =
    allUsers.map(user => `

      <tr>

        <td>
          ${escapeHtml(user.full_name || "Unnamed")}
        </td>

        <td>
          ${escapeHtml(user.email)}
        </td>

        <td>

          <select
            id="role-${user.id}"
            style="background:#080a10;color:white;border:1px solid var(--border);padding:7px;border-radius:7px;">

            <option value="coworker"
              ${user.role === "coworker" ? "selected" : ""}>
              Coworker
            </option>

            <option value="reviewer"
              ${user.role === "reviewer" ? "selected" : ""}>
              Reviewer
            </option>

            <option value="admin"
              ${user.role === "admin" ? "selected" : ""}>
              Admin
            </option>

            <option value="waitlist"
              ${user.role === "waitlist" ? "selected" : ""}>
              Waitlist
            </option>

          </select>

        </td>

        <td>

          <select
            id="status-${user.id}"
            style="background:#080a10;color:white;border:1px solid var(--border);padding:7px;border-radius:7px;">

            <option value="active"
              ${user.status === "active" ? "selected" : ""}>
              Active
            </option>

            <option value="waitlist"
              ${user.status === "waitlist" ? "selected" : ""}>
              Waitlist
            </option>

            <option value="suspended"
              ${user.status === "suspended" ? "selected" : ""}>
              Suspended
            </option>

          </select>

        </td>

        <td>
          <input
            id="2d-${user.id}"
            type="checkbox"
            ${user.access_2d ? "checked" : ""}>
        </td>

        <td>
          <input
            id="3d-${user.id}"
            type="checkbox"
            ${user.access_3d ? "checked" : ""}>
        </td>

        <td>

          <button
            onclick="saveUser('${user.id}')"
            class="secondary-btn"
            style="width:auto;padding:7px 11px;">
            Save
          </button>

        </td>

      </tr>

    `).join("");
}

async function saveUser(userId) {

  const role =
    $(`role-${userId}`).value;

  const status =
    $(`status-${userId}`).value;

  const access2d =
    $(`2d-${userId}`).checked;

  const access3d =
    $(`3d-${userId}`).checked;

  const { error } =
    await supabaseClient
      .from("profiles")
      .update({
        role,
        status,
        access_2d: access2d,
        access_3d: access3d
      })
      .eq("id", userId);

  if (error) {
    alert(error.message);
    return;
  }

  alert(
    "User access updated."
  );

  await loadUsers();
}

async function inviteUser() {

  const name =
    $("inviteName").value.trim();

  const email =
    $("inviteEmail").value.trim();

  const role =
    $("inviteRole").value;

  const access2d =
    $("invite2d").checked;

  const access3d =
    $("invite3d").checked;

  if (!name || !email) {

    msg(
      "inviteMessage",
      "Enter the user's name and email.",
      "error"
    );

    return;
  }

  const button =
    $("inviteButton");

  button.disabled = true;
  button.textContent =
    "Sending invitation...";

  const { data, error } =
    await supabaseClient.functions.invoke(
      "admin-user",
      {
        body: {
          action: "invite",
          email,
          full_name: name,
          role,
          access_2d: access2d,
          access_3d: access3d,
          redirect_to:
            window.location.origin +
            window.location.pathname
              .replace("admin.html", "index.html")
        }
      }
    );

  button.disabled = false;
  button.textContent =
    "Send Invitation";

  if (error) {

    msg(
      "inviteMessage",
      error.message,
      "error"
    );

    return;
  }

  if (!data?.ok) {

    msg(
      "inviteMessage",
      data?.error || "Invitation failed.",
      "error"
    );

    return;
  }

  msg(
    "inviteMessage",
    "Invitation sent successfully.",
    "success"
  );

  $("inviteName").value = "";
  $("inviteEmail").value = "";

  await loadUsers();
}

async function createTask() {

  const name =
    $("taskName").value.trim();

  const type =
    $("taskType").value;

  const description =
    $("taskDescription").value.trim();

  const fps =
    Number($("taskFps").value || 5);

  if (!name) {

    msg(
      "taskMessage",
      "Enter a task name.",
      "error"
    );

    return;
  }

  const { data, error } =
    await supabaseClient
      .from("tasks")
      .insert({
        name,
        task_type: type,
        description,
        fps,
        status: "open",
        created_by: currentUser.id
      })
      .select()
      .single();

  if (error) {

    msg(
      "taskMessage",
      error.message,
      "error"
    );

    return;
  }

  msg(
    "taskMessage",
    "Task created successfully.",
    "success"
  );

  $("taskName").value = "";
  $("taskDescription").value = "";

  await loadTasks();
}

async function loadTasks() {

  const { data, error } =
    await supabaseClient
      .from("tasks")
      .select(`
        id,
        name,
        task_type,
        status,
        fps,
        frame_count,
        task_assignments(
          id,
          user_id,
          status
        )
      `)
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(error);
    return;
  }

  allTasks = data || [];

  const activeUsers =
    allUsers.filter(
      u =>
        u.status === "active" &&
        u.role !== "waitlist"
    );

  $("tasksTable").innerHTML =
    allTasks.map(task => {

      const assignment =
        (task.task_assignments || [])
        .find(a =>
          ["assigned","in_progress","submitted"]
            .includes(a.status)
        );

      const assignedUser =
        assignment
          ? allUsers.find(
              u => u.id === assignment.user_id
            )
          : null;

      return `

        <tr>

          <td>
            <strong>
              ${escapeHtml(task.name)}
            </strong>
          </td>

          <td>
            ${task.task_type.toUpperCase()}
          </td>

          <td>
            ${escapeHtml(task.status)}
          </td>

          <td>

            <select
              id="assign-${task.id}"
              style="background:#080a10;color:white;border:1px solid var(--border);padding:7px;border-radius:7px;">

              <option value="">
                ${assignedUser
                  ? escapeHtml(assignedUser.full_name)
                  : "Unassigned"}
              </option>

              ${activeUsers.map(user => `
                <option value="${user.id}">
                  ${escapeHtml(user.full_name)}
                </option>
              `).join("")}

            </select>

          </td>

          <td>

            <button
              class="green-btn"
              style="width:auto;padding:7px 11px;"
              onclick="assignTask('${task.id}')">
              Assign
            </button>

          </td>

        </tr>

      `;

    }).join("");

  $("uploadTask").innerHTML =
    allTasks.map(task => `
      <option value="${task.id}">
        ${escapeHtml(task.name)}
      </option>
    `).join("");
}

async function assignTask(taskId) {

  const userId =
    $(`assign-${taskId}`).value;

  if (!userId) {
    alert(
      "Select a coworker."
    );
    return;
  }

  const { error } =
    await supabaseClient
      .from("task_assignments")
      .insert({
        task_id: taskId,
        user_id: userId,
        assigned_by: currentUser.id,
        status: "assigned"
      });

  if (error) {

    alert(
      "Assignment failed: " +
      error.message
    );

    return;
  }

  await supabaseClient
    .from("tasks")
    .update({
      status: "assigned"
    })
    .eq("id", taskId);

  alert(
    "Task assigned."
  );

  await loadTasks();
}

async function loadRequests() {

  const { data, error } =
    await supabaseClient
      .from("access_requests")
      .select(`
        id,
        user_id,
        requested_2d,
        requested_3d,
        note,
        status,
        created_at
      `)
      .eq("status", "pending")
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(error);
    return;
  }

  $("requestsTable").innerHTML =
    (data || []).map(request => {

      const user =
        allUsers.find(
          u => u.id === request.user_id
        );

      return `

        <tr>

          <td>
            ${escapeHtml(
              user?.full_name || "Unknown"
            )}
          </td>

          <td>
            ${request.requested_2d ? "YES" : "—"}
          </td>

          <td>
            ${request.requested_3d ? "YES" : "—"}
          </td>

          <td>
            ${escapeHtml(
              request.note || ""
            )}
          </td>

          <td>

            <button
              class="green-btn"
              style="width:auto;padding:7px 10px;"
              onclick="approveRequest(
                '${request.id}',
                '${request.user_id}',
                ${request.requested_2d},
                ${request.requested_3d}
              )">
              Approve
            </button>

          </td>

        </tr>

      `;

    }).join("") ||
    `
      <tr>
        <td colspan="5"
            style="color:var(--muted);">
          No pending access requests.
        </td>
      </tr>
    `;
}

async function approveRequest(
  requestId,
  userId,
  access2d,
  access3d
) {

  const { error: profileError } =
    await supabaseClient
      .from("profiles")
      .update({
        status: "active",
        role: "coworker",
        access_2d: access2d,
        access_3d: access3d
      })
      .eq("id", userId);

  if (profileError) {
    alert(profileError.message);
    return;
  }

  const { error: requestError } =
    await supabaseClient
      .from("access_requests")
      .update({
        status: "approved",
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId);

  if (requestError) {
    alert(requestError.message);
    return;
  }

  await loadUsers();
  await loadRequests();
}

function waitForVideoEvent(video, event) {

  return new Promise(resolve => {

    const handler = () => {

      video.removeEventListener(
        event,
        handler
      );

      resolve();
    };

    video.addEventListener(
      event,
      handler,
      { once: true }
    );
  });
}

async function extractFrames() {

  const taskId =
    $("uploadTask").value;

  const camera =
    $("uploadCamera").value;

  const file =
    $("videoFile").files[0];

  if (!taskId || !file) {

    msg(
      "extractProgress",
      "Select a task and video.",
      "error"
    );

    return;
  }

  const task =
    allTasks.find(
      x => x.id === taskId
    );

  const fps =
    Number(task?.fps || 5);

  const objectUrl =
    URL.createObjectURL(file);

  const video =
    document.createElement("video");

  video.src =
    objectUrl;

  video.muted = true;
  video.preload = "metadata";

  await waitForVideoEvent(
    video,
    "loadedmetadata"
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

  const step =
    1 / fps;

  const maxFrames = 300;

  let frameNumber = 0;

  msg(
    "extractProgress",
    `Processing ${duration.toFixed(1)} seconds at ${fps} FPS...`
  );

  for (
    let time = 0;
    time < duration && frameNumber < maxFrames;
    time += step
  ) {

    video.currentTime =
      Math.min(
        time,
        Math.max(0, duration - .01)
      );

    await waitForVideoEvent(
      video,
      "seeked"
    );

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob =
      await new Promise(resolve => {

        canvas.toBlob(
          resolve,
          "image/jpeg",
          .82
        );

      });

    if (!blob) continue;

    frameNumber++;

    const path =
      `tasks/${taskId}/frames/${camera}/frame-${String(frameNumber).padStart(6,"0")}.jpg`;

    const { error: uploadError } =
      await supabaseClient
        .storage
        .from("task-media")
        .upload(
          path,
          blob,
          {
            contentType: "image/jpeg",
            upsert: true
          }
        );

    if (uploadError) {

      msg(
        "extractProgress",
        uploadError.message,
        "error"
      );

      URL.revokeObjectURL(
        objectUrl
      );

      return;
    }

    const { error: frameError } =
      await supabaseClient
        .from("frames")
        .insert({
          task_id: taskId,
          frame_number: frameNumber,
          timestamp_ms: Math.round(
            time * 1000
          ),
          camera_name: camera,
          image_path: path
        });

    if (frameError) {

      msg(
        "extractProgress",
        frameError.message,
        "error"
      );

      return;
    }

    if (frameNumber % 5 === 0) {

      msg(
        "extractProgress",
        `Uploaded ${frameNumber} frames...`
      );
    }
  }

  await supabaseClient
    .from("tasks")
    .update({
      frame_count: frameNumber
    })
    .eq("id", taskId);

  URL.revokeObjectURL(
    objectUrl
  );

  msg(
    "extractProgress",
    `Completed. ${frameNumber} frames stored for ${camera}.`,
    "success"
  );

  await loadTasks();
}

async function initialise() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return;
  }

  currentUser =
    session.user;

  const { data: profileData, error } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

  if (error || !profileData) {
    window.location.href = "home.html";
    return;
  }

  currentProfile =
    profileData;

  if (
    currentProfile.status !== "active" ||
    currentProfile.role !== "admin"
  ) {

    alert(
      "Administrator access required."
    );

    window.location.href =
      "home.html";

    return;
  }

  $("adminName").textContent =
    currentProfile.full_name ||
    "Administrator";

  await loadUsers();
  await loadTasks();
  await loadRequests();
}

$("inviteButton").onclick =
  inviteUser;

$("createTaskButton").onclick =
  createTask;

$("extractButton").onclick =
  extractFrames;

$("backHome").onclick = () => {
  window.location.href =
    "home.html";
};

window.saveUser = saveUser;
window.assignTask = assignTask;
window.approveRequest = approveRequest;

initialise();
