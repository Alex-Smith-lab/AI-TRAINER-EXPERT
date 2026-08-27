/* ============================================================
   AI TRAINER EXPERT
   Main Application
   Supabase JS v2
============================================================ */


/* ============================================================
   SUPABASE CONFIGURATION
============================================================ */

/*
  IMPORTANT:

  This is the PUBLIC Supabase project URL.

  The project reference comes from your Supabase public key.
*/

const SUPABASE_URL =
  "https://mlmldgwzvkpprwkmfdlh.supabase.co";


/*
  Public publishable key.

  NEVER put a Supabase service_role key in this file.
*/

const SUPABASE_KEY =
  "sb_publishable_8WucrYYIhnr1EXdNMkdMsQ_vFtZecB2";


/*
  Create Supabase client.

  Supabase v2 automatically manages the browser session.
*/

const { createClient } = window.supabase;

const supabaseClient = createClient(
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

let currentUser = null;
let currentProfile = null;

let allTasks = [];
let allUsers = [];

let currentPage = "home";


/* ============================================================
   DOM HELPERS
============================================================ */

const $ = (id) => document.getElementById(id);

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return [...document.querySelectorAll(selector)];
}


/* ============================================================
   START APPLICATION
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {

  bindLoginEvents();
  bindNavigationEvents();
  bindAdminEvents();

  updateClock();

  setInterval(updateClock, 60000);

  await initializeApplication();

});


/* ============================================================
   INITIALIZE
============================================================ */

async function initializeApplication() {

  try {

    /*
      First check whether Supabase can actually be reached.

      This is useful because "Failed to fetch" normally means
      the browser couldn't reach the API at all.
    */

    const reachable = await testSupabaseConnection();

    if (!reachable) {

      showLoginMessage(
        "Cannot reach the Supabase server. Check that the project is active and that this Supabase URL is correct.",
        "error"
      );

      return;
    }


    /*
      Get existing session.
    */

    const {
      data,
      error
    } = await supabaseClient.auth.getSession();


    if (error) {

      console.error(
        "Supabase getSession error:",
        error
      );

      showLoginMessage(
        friendlySupabaseError(error),
        "error"
      );

      return;
    }


    if (data && data.session) {

      await handleSignedInUser(
        data.session.user
      );

    }


    /*
      Listen for future authentication changes.
    */

    supabaseClient.auth.onAuthStateChange(
      async (event, session) => {

        console.log(
          "Auth event:",
          event
        );

        if (
          event === "SIGNED_IN" &&
          session
        ) {

          await handleSignedInUser(
            session.user
          );

        }

        if (event === "SIGNED_OUT") {

          currentUser = null;
          currentProfile = null;

          showLoginScreen();

        }

      }
    );

  } catch (error) {

    console.error(
      "Initialization error:",
      error
    );

    showLoginMessage(
      "The application could not connect to Supabase. Open the browser console for the technical error.",
      "error"
    );

  }

}


/* ============================================================
   SUPABASE CONNECTION TEST
============================================================ */

async function testSupabaseConnection() {

  try {

    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/health`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY
        }
      }
    );

    return response.ok;

  } catch (error) {

    console.error(
      "Supabase network test failed:",
      error
    );

    return false;
  }

}


/* ============================================================
   LOGIN EVENTS
============================================================ */

function bindLoginEvents() {

  $("loginForm").addEventListener(
    "submit",
    handleLogin
  );


  $("togglePassword").addEventListener(
    "click",
    () => {

      const input =
        $("loginPassword");

      if (
        input.type === "password"
      ) {

        input.type = "text";

        $("togglePassword").textContent =
          "Hide";

      } else {

        input.type = "password";

        $("togglePassword").textContent =
          "Show";

      }

    }
  );


  $("forgotPassword").addEventListener(
    "click",
    handleForgotPassword
  );


  $("logoutButton").addEventListener(
    "click",
    logout
  );


  $("refreshTasks").addEventListener(
    "click",
    loadTasks
  );

}


/* ============================================================
   LOGIN
============================================================ */

async function handleLogin(event) {

  event.preventDefault();

  const email =
    $("loginEmail")
      .value
      .trim()
      .toLowerCase();

  const password =
    $("loginPassword").value;


  if (!email || !password) {

    showLoginMessage(
      "Enter your email and password.",
      "error"
    );

    return;
  }


  setLoginLoading(true);

  clearLoginMessage();


  try {

    console.log(
      "Attempting Supabase authentication..."
    );


    const {
      data,
      error
    } = await supabaseClient.auth.signInWithPassword({

      email: email,

      password: password

    });


    if (error) {

      console.error(
        "Supabase login error:",
        error
      );

      showLoginMessage(
        friendlyAuthError(error),
        "error"
      );

      return;
    }


    if (
      !data ||
      !data.user
    ) {

      showLoginMessage(
        "Login was not completed. Please try again.",
        "error"
      );

      return;
    }


    console.log(
      "Supabase login successful."
    );


    await handleSignedInUser(
      data.user
    );


  } catch (error) {

    console.error(
      "Login exception:",
      error
    );


    /*
      This catches the exact "Failed to fetch" case.
    */

    if (
      String(error.message)
        .toLowerCase()
        .includes("failed to fetch")
    ) {

      showLoginMessage(
        "Failed to fetch Supabase. The website cannot reach the Supabase API. Check the Supabase project URL, project status, browser network connection and whether the project is paused.",
        "error"
      );

    } else {

      showLoginMessage(
        error.message ||
        "Unexpected login error.",
        "error"
      );

    }

  } finally {

    setLoginLoading(false);

  }

}


/* ============================================================
   AUTH ERROR
============================================================ */

function friendlyAuthError(error) {

  const message =
    String(
      error?.message || ""
    ).toLowerCase();


  if (
    message.includes(
      "invalid login credentials"
    )
  ) {

    return "Incorrect email or password.";

  }


  if (
    message.includes(
      "email not confirmed"
    )
  ) {

    return "Your email has not been confirmed yet.";

  }


  if (
    message.includes(
      "too many requests"
    )
  ) {

    return "Too many login attempts. Please wait a few minutes.";

  }


  if (
    message.includes(
      "failed to fetch"
    )
  ) {

    return "Failed to fetch Supabase. The browser cannot reach the authentication server.";

  }


  return (
    error?.message ||
    "Unable to sign in."
  );

}


/* ============================================================
   SUPABASE ERROR
============================================================ */

function friendlySupabaseError(error) {

  if (
    !error
  ) {

    return "Supabase connection error.";

  }

  return (
    error.message ||
    error.hint ||
    "Supabase returned an unknown error."
  );

}


/* ============================================================
   FORGOT PASSWORD
============================================================ */

async function handleForgotPassword() {

  const email =
    $("loginEmail")
      .value
      .trim()
      .toLowerCase();


  if (!email) {

    showLoginMessage(
      "Enter your email address first, then click Forgot password.",
      "error"
    );

    return;
  }


  try {

    const redirectUrl =
      window.location.origin +
      window.location.pathname;


    const {
      error
    } =
      await supabaseClient.auth
        .resetPasswordForEmail(
          email,
          {
            redirectTo: redirectUrl
          }
        );


    if (error) {

      showLoginMessage(
        error.message,
        "error"
      );

      return;
    }


    showLoginMessage(
      "Password reset instructions have been sent if the account exists.",
      "success"
    );

  } catch (error) {

    console.error(error);

    showLoginMessage(
      "Unable to send the password reset request.",
      "error"
    );

  }

}


/* ============================================================
   SIGNED-IN USER
============================================================ */

async function handleSignedInUser(user) {

  currentUser = user;


  try {

    currentProfile =
      await getUserProfile(
        user.id
      );


    /*
      If the profile does not exist,
      create a safe waiting profile.

      The user still cannot perform protected work
      until an admin gives access.
    */

    if (!currentProfile) {

      currentProfile =
        await createMissingProfile(
          user
        );

    }


    if (
      !currentProfile
    ) {

      await supabaseClient.auth.signOut();

      showLoginScreen();

      showLoginMessage(
        "Your account does not have an active profile. Ask an administrator to give you access.",
        "error"
      );

      return;
    }


    /*
      Disabled / waitlisted accounts.
    */

    if (
      currentProfile.status === "disabled"
    ) {

      await supabaseClient.auth.signOut();

      showLoginScreen();

      showLoginMessage(
        "Your account has been disabled. Contact an administrator.",
        "error"
      );

      return;
    }


    if (
      currentProfile.status === "waitlist"
    ) {

      await supabaseClient.auth.signOut();

      showLoginScreen();

      showLoginMessage(
        "Your account is on the waitlist. An administrator must approve your access before you can enter the workspace.",
        "error"
      );

      return;
    }


    /*
      Everything is good.
    */

    showAppScreen();

    renderUserIdentity();

    await loadTasks();

    await loadActivity();

    if (
      currentProfile.role === "admin"
    ) {

      $("adminNav")
        .classList
        .remove("hidden");

    } else {

      $("adminNav")
        .classList
        .add("hidden");

    }


  } catch (error) {

    console.error(
      "User initialization error:",
      error
    );

    await supabaseClient.auth.signOut();

    showLoginScreen();

    showLoginMessage(
      "Your account was authenticated but your profile could not be loaded. Check your Supabase RLS policies.",
      "error"
    );

  }

}


/* ============================================================
   PROFILE
============================================================ */

async function getUserProfile(userId) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();


  if (error) {

    console.error(
      "Profile query error:",
      error
    );

    throw error;
  }


  return data;

}


/* ============================================================
   CREATE MISSING PROFILE
============================================================ */

async function createMissingProfile(user) {

  try {

    const metadata =
      user.user_metadata || {};


    const fullName =
      metadata.full_name ||
      metadata.name ||
      user.email
        ?.split("@")[0] ||
      "User";


    const {
      data,
      error
    } =
      await supabaseClient
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          role: "waitlist",
          status: "waitlist",
          access_2d: false,
          access_3d: false
        })
        .select()
        .single();


    if (error) {

      /*
        Another session may already have created it.
      */

      if (
        error.code === "23505"
      ) {

        return await getUserProfile(
          user.id
        );

      }

      console.error(
        "Profile creation error:",
        error
      );

      return null;
    }


    return data;

  } catch (error) {

    console.error(error);

    return null;
  }

}


/* ============================================================
   UI
============================================================ */

function showLoginScreen() {

  $("loginScreen")
    .classList
    .remove("hidden");

  $("appScreen")
    .classList
    .add("hidden");

}


function showAppScreen() {

  $("loginScreen")
    .classList
    .add("hidden");

  $("appScreen")
    .classList
    .remove("hidden");

}


function setLoginLoading(loading) {

  $("loginButton")
    .disabled = loading;

  $("loginButtonText")
    .textContent =
      loading
        ? "Signing in..."
        : "Sign in";

  $("loginSpinner")
    .classList
    .toggle(
      "hidden",
      !loading
    );

}


function showLoginMessage(
  message,
  type = "error"
) {

  const box =
    $("loginMessage");

  box.textContent =
    message;

  box.className =
    `login-message ${type}`;

}


function clearLoginMessage() {

  $("loginMessage")
    .className =
      "login-message hidden";

}


/* ============================================================
   USER IDENTITY
============================================================ */

function renderUserIdentity() {

  const profile =
    currentProfile;


  const name =
    profile.full_name ||
    currentUser.email
      ?.split("@")[0] ||
    "User";


  $("topUserName")
    .textContent =
      name;


  $("topUserRole")
    .textContent =
      formatRole(
        profile.role
      );


  $("welcomeName")
    .textContent =
      `Welcome back, ${name}.`;


  $("topAvatar")
    .textContent =
      getInitials(name);


  $("roleStat")
    .textContent =
      formatRole(
        profile.role
      );


  $("currentDate")
    .textContent =
      new Date()
        .toLocaleDateString(
          undefined,
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          }
        );

}


function getInitials(name) {

  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(
      x => x[0]
        .toUpperCase()
    )
    .join("");

}


function formatRole(role) {

  const roles = {

    admin: "Administrator",

    reviewer: "Reviewer",

    coworker: "Coworker",

    worker: "Worker",

    waitlist: "Waitlist"

  };


  return (
    roles[role] ||
    "Worker"
  );

}


/* ============================================================
   GREETING
============================================================ */

function updateClock() {

  const hour =
    new Date()
      .getHours();


  let greeting =
    "Good evening";


  if (
    hour < 12
  ) {

    greeting =
      "Good morning";

  } else if (
    hour < 18
  ) {

    greeting =
      "Good afternoon";

  }


  const element =
    $("greeting");


  if (element) {

    element.textContent =
      greeting;

  }

}


/* ============================================================
   TASKS
============================================================ */

async function loadTasks() {

  if (!currentUser) {

    return;

  }


  try {

    /*
      Load tasks assigned to current user
      OR unclaimed tasks assigned to no one.
    */

    const {
      data,
      error
    } =
      await supabaseClient
        .from("tasks")
        .select("*")
        .or(
          `assigned_to.eq.${currentUser.id},assigned_to.is.null`
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        "Task query error:",
        error
      );

      throw error;

    }


    allTasks =
      data || [];


    /*
      Only display tasks that the user can actually access.
    */

    const accessible =
      allTasks.filter(
        task =>
          task.status !== "completed" &&
          canAccessTask(task)
      );


    renderTaskCards(
      accessible
    );


    renderMyTasks(
      allTasks
    );


    updateStats(
      allTasks
    );


  } catch (error) {

    console.error(error);

    showToast(
      "Unable to load tasks.",
      "error"
    );

  }

}


/* ============================================================
   TASK ACCESS
============================================================ */

function canAccessTask(task) {

  if (
    currentProfile.role === "admin"
  ) {

    return true;

  }


  const type =
    String(
      task.task_type ||
      task.type ||
      ""
    ).toLowerCase();


  if (
    type === "3d" &&
    !currentProfile.access_3d
  ) {

    return false;

  }


  if (
    type === "2d" &&
    !currentProfile.access_2d
  ) {

    return false;

  }


  if (
    type === "both" &&
    (
      !currentProfile.access_2d ||
      !currentProfile.access_3d
    )
  ) {

    return false;

  }


  return true;

}


/* ============================================================
   TASK CARDS
============================================================ */

function renderTaskCards(tasks) {

  const container =
    $("taskList");

  container.innerHTML =
    "";


  if (
    !tasks.length
  ) {

    $("emptyTasks")
      .classList
      .remove("hidden");

    return;

  }


  $("emptyTasks")
    .classList
    .add("hidden");


  tasks.forEach(
    task => {

      const card =
        createTaskCard(task);

      container.appendChild(card);

    }
  );

}


function createTaskCard(task) {

  const card =
    document.createElement("div");


  const type =
    String(
      task.task_type ||
      task.type ||
      "2d"
    ).toLowerCase();


  card.className =
    `task-card task-${type}`;


  const label =
    type === "3d"
      ? "3D LIDAR"
      : type === "both"
        ? "2D + 3D"
        : "2D CAMERA";


  const assigned =
    task.assigned_to
      ? "Assigned"
      : "Available";


  card.innerHTML = `

    <div class="task-top">

      <span class="task-type ${
        type === "2d"
          ? "type-2d"
          : ""
      }">
        ${escapeHTML(label)}
      </span>

      <span class="task-type">
        ${escapeHTML(assigned)}
      </span>

    </div>

    <h3>
      ${escapeHTML(
        task.name ||
        task.task_name ||
        "Annotation task"
      )}
    </h3>

    <div class="task-description">
      ${escapeHTML(
        task.description ||
        "Annotation task ready for processing."
      )}
    </div>

    <div class="task-meta">

      <span>
        TYPE:
        <strong>${escapeHTML(label)}</strong>
      </span>

      <span>
        STATUS:
        <strong>${escapeHTML(
          task.status || "assigned"
        )}</strong>
      </span>

    </div>

    <button
      class="primary-button claim-button"
      data-task-id="${task.id}"
    >
      ${
        task.claimed_by === currentUser.id ||
        task.assigned_to === currentUser.id
          ? "Start tasking"
          : "Claim task"
      }
    </button>

  `;


  const button =
    card.querySelector(
      ".claim-button"
    );


  button.addEventListener(
    "click",
    () => handleTaskAction(task)
  );


  return card;

}


/* ============================================================
   CLAIM / START TASK
============================================================ */

async function handleTaskAction(task) {

  /*
    If already claimed by current user,
    open workspace immediately.
  */

  if (
    task.claimed_by === currentUser.id ||
    task.assigned_to === currentUser.id
  ) {

    openWorkspace(task);

    return;

  }


  /*
    If someone else already claimed it,
    stop.
  */

  if (
    task.claimed_by &&
    task.claimed_by !== currentUser.id
  ) {

    showToast(
      "This task has already been claimed by another user.",
      "error"
    );

    await loadTasks();

    return;

  }


  try {

    /*
      Atomic-style update:
      only update where claimed_by is null.

      This prevents two workers from successfully
      claiming the same task in normal concurrent use.
    */

    const {
      data,
      error
    } =
      await supabaseClient
        .from("tasks")
        .update({
          claimed_by: currentUser.id,
          claimed_at: new Date().toISOString(),
          status: "in_progress"
        })
        .eq("id", task.id)
        .is("claimed_by", null)
        .select()
        .single();


    if (error) {

      console.error(
        "Claim error:",
        error
      );

      showToast(
        "The task could not be claimed. It may already be taken.",
        "error"
      );

      await loadTasks();

      return;

    }


    if (!data) {

      showToast(
        "Someone else claimed this task first.",
        "error"
      );

      await loadTasks();

      return;

    }


    await logActivity(
      "claimed_task",
      task.id,
      `Claimed ${task.name}`
    );


    openWorkspace(data);


  } catch (error) {

    console.error(error);

    showToast(
      "Unable to claim task.",
      "error"
    );

  }

}


/* ============================================================
   OPEN WORKSPACE
============================================================ */

function openWorkspace(task) {

  const type =
    String(
      task.task_type ||
      task.type ||
      "2d"
    ).toLowerCase();


  /*
    Final access check before workspace.

    This is important for direct task links.
  */

  if (
    !canAccessTask(task)
  ) {

    showToast(
      "Access denied. Your account does not have permission for this task type.",
      "error"
    );

    return;

  }


  const params =
    new URLSearchParams();


  params.set(
    "task",
    task.id
  );


  params.set(
    "mode",
    type
  );


  window.location.href =
    `workspace.html?${params.toString()}`;

}


/* ============================================================
   MY TASKS
============================================================ */

function renderMyTasks(tasks) {

  const container =
    $("myTasksList");


  container.innerHTML =
    "";


  const mine =
    tasks.filter(
      task =>
        task.assigned_to === currentUser.id ||
        task.claimed_by === currentUser.id
    );


  if (!mine.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◌</div>
        <h3>No tasks yet</h3>
        <p>Your assigned tasks will appear here.</p>
      </div>
    `;

    return;

  }


  mine.forEach(
    task => {

      const item =
        document.createElement("div");

      item.className =
        "full-task-item";


      const type =
        String(
          task.task_type ||
          task.type ||
          "2d"
        ).toUpperCase();


      item.innerHTML = `

        <div>

          <strong>
            ${escapeHTML(
              task.name ||
              "Annotation task"
            )}
          </strong>

          <div
            style="
              margin-top:5px;
              color:#64748b;
              font-size:9px;
            "
          >
            ${escapeHTML(type)}
            •
            ${escapeHTML(
              task.status ||
              "assigned"
            )}
          </div>

        </div>

        <button
          class="secondary-button"
        >
          Open workspace
        </button>

      `;


      item.querySelector(
        "button"
      ).addEventListener(
        "click",
        () => openWorkspace(task)
      );


      container.appendChild(item);

    }
  );

}


/* ============================================================
   STATS
============================================================ */

function updateStats(tasks) {

  const assigned =
    tasks.filter(
      t =>
        t.assigned_to === currentUser.id ||
        t.claimed_by === currentUser.id
    );


  const completed =
    assigned.filter(
      t =>
        t.status === "completed"
    );


  $("assignedCount")
    .textContent =
      assigned.length;


  $("completedCount")
    .textContent =
      completed.length;


  /*
    Annotation total is loaded separately.
  */

  loadAnnotationCount();

}


async function loadAnnotationCount() {

  try {

    const {
      count,
      error
    } =
      await supabaseClient
        .from("annotations")
        .select(
          "id",
          {
            count: "exact",
            head: true
          }
        )
        .eq(
          "created_by",
          currentUser.id
        );


    if (error) {

      console.warn(
        "Annotation count:",
        error
      );

      return;

    }


    $("boxCount")
      .textContent =
      count || 0;

  } catch (error) {

    console.warn(error);

  }

}


/* ============================================================
   ACTIVITY
============================================================ */

async function logActivity(
  action,
  taskId,
  description
) {

  try {

    await supabaseClient
      .from("activity_logs")
      .insert({
        user_id: currentUser.id,
        task_id: taskId || null,
        action,
        description
      });

  } catch (error) {

    console.warn(
      "Activity log error:",
      error
    );

  }

}


async function loadActivity() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("activity_logs")
        .select("*")
        .eq(
          "user_id",
          currentUser.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(30);


    if (error) {

      console.warn(error);

      return;

    }


    const container =
      $("activityList");


    container.innerHTML =
      "";


    if (
      !data ||
      !data.length
    ) {

      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◷</div>
          <h3>No activity yet</h3>
          <p>Your task activity will appear here.</p>
        </div>
      `;

      return;

    }


    data.forEach(
      item => {

        const element =
          document.createElement("div");

        element.className =
          "activity-item";


        element.innerHTML = `

          <div class="activity-dot"></div>

          <div>

            <strong>
              ${escapeHTML(
                item.description ||
                item.action ||
                "Activity"
              )}
            </strong>

            <span>
              ${formatDateTime(
                item.created_at
              )}
            </span>

          </div>

        `;


        container.appendChild(
          element
        );

      }
    );

  } catch (error) {

    console.warn(error);

  }

}


/* ============================================================
   NAVIGATION
============================================================ */

function bindNavigationEvents() {

  qsa(".nav-item")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const page =
              button.dataset.page;

            navigateToPage(page);

          }
        );

      }
    );

}


function navigateToPage(page) {

  if (
    page === "admin" &&
    currentProfile.role !== "admin"
  ) {

    showToast(
      "Administrator access required.",
      "error"
    );

    return;

  }


  currentPage =
    page;


  qsa(".nav-item")
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page === page
        );

      }
    );


  qsa(".page")
    .forEach(
      element => {

        element.classList.remove(
          "active-page"
        );

      }
    );


  const target =
    $(`${page}Page`);


  if (target) {

    target.classList.add(
      "active-page"
    );

  }


  const names = {

    home: "Annotation Operations",

    tasks: "My Tasks",

    activity: "Activity",

    admin: "Administration"

  };


  $("pageLocation")
    .textContent =
      names[page] ||
      "Annotation Operations";


  if (
    page === "admin"
  ) {

    loadAdminData();

  }

}


/* ============================================================
   ADMIN
============================================================ */

function bindAdminEvents() {

  qsa(".admin-tab")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            qsa(".admin-tab")
              .forEach(
                b =>
                  b.classList.remove(
                    "active"
                  )
              );


            button.classList.add(
              "active"
            );


            const tab =
              button.dataset.adminTab;


            qsa(".admin-panel")
              .forEach(
                panel =>
                  panel.classList.remove(
                    "active"
                  )
              );


            const panel =
              $(
                `admin${
                  tab.charAt(0)
                    .toUpperCase() +
                  tab.slice(1)
                }`
              );


            if (panel) {

              panel.classList.add(
                "active"
              );

            }

          }
        );

      }
    );


  $("createTaskForm")
    .addEventListener(
      "submit",
      createTask
    );


  $("refreshUsers")
    .addEventListener(
      "click",
      loadAdminUsers
    );

}


async function loadAdminData() {

  if (
    currentProfile.role !== "admin"
  ) {

    return;

  }


  await Promise.all([
    loadAdminUsers(),
    loadAdminTasks(),
    loadAccessRequests()
  ]);

}


/* ============================================================
   ADMIN USERS
============================================================ */

async function loadAdminUsers() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("profiles")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      throw error;

    }


    allUsers =
      data || [];


    renderUsersTable(
      allUsers
    );


    populateAssigneeSelect(
      allUsers
    );


    const total =
      allUsers.length;


    const workers =
      allUsers.filter(
        u =>
          u.role === "worker" ||
          u.role === "coworker"
      ).length;


    const reviewers =
      allUsers.filter(
        u =>
          u.role === "reviewer"
      ).length;


    const waitlist =
      allUsers.filter(
        u =>
          u.role === "waitlist"
      ).length;


    $("adminTotalUsers")
      .textContent =
      total;


    $("adminWorkers")
      .textContent =
      workers;


    $("adminReviewers")
      .textContent =
      reviewers;


    $("adminWaitlist")
      .textContent =
      waitlist;


  } catch (error) {

    console.error(
      "Admin users:",
      error
    );

    showToast(
      "Unable to load users.",
      "error"
    );

  }

}


/* ============================================================
   USERS TABLE
============================================================ */

function renderUsersTable(users) {

  const container =
    $("usersTable");


  container.innerHTML = `

    <div class="user-row header">

      <div>User</div>
      <div>Role</div>
      <div>Status</div>
      <div>Access</div>
      <div>Actions</div>

    </div>

  `;


  users.forEach(
    user => {

      const row =
        document.createElement("div");

      row.className =
        "user-row";


      const isSelf =
        user.id === currentUser.id;


      row.innerHTML = `

        <div>

          <strong>
            ${escapeHTML(
              user.full_name ||
              "Unnamed"
            )}
          </strong>

          <div
            style="
              color:#64748b;
              margin-top:3px;
              font-size:8px;
            "
          >
            ${escapeHTML(
              user.email ||
              ""
            )}
          </div>

        </div>


        <div>

          <select
            class="role-select"
            data-user-id="${user.id}"
            ${
              isSelf
                ? "disabled"
                : ""
            }
          >

            ${roleOption(
              "worker",
              user.role
            )}

            ${roleOption(
              "coworker",
              user.role
            )}

            ${roleOption(
              "reviewer",
              user.role
            )}

            ${roleOption(
              "admin",
              user.role
            )}

            ${roleOption(
              "waitlist",
              user.role
            )}

          </select>

        </div>


        <div>

          <span class="access-pill ${
            user.status === "active"
              ? "yes"
              : "no"
          }">

            ${escapeHTML(
              user.status ||
              "waitlist"
            )}

          </span>

        </div>


        <div>

          <span
            class="access-pill ${
              user.access_2d
                ? "yes"
                : "no"
            }"
          >
            2D
          </span>

          <span
            class="access-pill ${
              user.access_3d
                ? "yes"
                : "no"
            }"
          >
            3D
          </span>

        </div>


        <div class="user-actions">

          ${
            !isSelf
              ? `
                <button
                  class="small-button"
                  data-action="access"
                  data-id="${user.id}"
                >
                  Access
                </button>

                <button
                  class="small-button danger"
                  data-action="disable"
                  data-id="${user.id}"
                >
                  ${
                    user.status === "disabled"
                      ? "Enable"
                      : "Disable"
                  }
                </button>
              `
              : `
                <span
                  style="
                    color:#64748b;
                    font-size:8px;
                  "
                >
                  Current account
                </span>
              `
          }

        </div>

      `;


      const roleSelect =
        row.querySelector(
          ".role-select"
        );


      if (roleSelect) {

        roleSelect.addEventListener(
          "change",
          event =>
            updateUserRole(
              user.id,
              event.target.value
            )
        );

      }


      row.querySelectorAll(
        "[data-action]"
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const action =
                button.dataset.action;

              const id =
                button.dataset.id;


              if (
                action === "access"
              ) {

                openAccessModal(
                  id
                );

              }


              if (
                action === "disable"
              ) {

                toggleUserStatus(
                  id
                );

              }

            }
          );

        }
      );


      container.appendChild(
        row
      );

    }
  );

}


function roleOption(
  role,
  selected
) {

  return `
    <option
      value="${role}"
      ${
        role === selected
          ? "selected"
          : ""
      }
    >
      ${formatRole(role)}
    </option>
  `;

}


/* ============================================================
   UPDATE ROLE
============================================================ */

async function updateUserRole(
  userId,
  role
) {

  try {

    const {
      error
    } =
      await supabaseClient
        .from("profiles")
        .update({
          role
        })
        .eq(
          "id",
          userId
        );


    if (error) {

      throw error;

    }


    await logAdminAudit(
      "role_changed",
      userId,
      `Role changed to ${role}`
    );


    showToast(
      "User role updated.",
      "success"
    );


    await loadAdminUsers();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to update role.",
      "error"
    );

  }

}


/* ============================================================
   USER STATUS
============================================================ */

async function toggleUserStatus(
  userId
) {

  const user =
    allUsers.find(
      u => u.id === userId
    );


  if (!user) {

    return;

  }


  const newStatus =
    user.status === "disabled"
      ? "active"
      : "disabled";


  try {

    const {
      error
    } =
      await supabaseClient
        .from("profiles")
        .update({
          status: newStatus
        })
        .eq(
          "id",
          userId
        );


    if (error) {

      throw error;

    }


    await logAdminAudit(
      "status_changed",
      userId,
      `User status changed to ${newStatus}`
    );


    showToast(
      `User ${newStatus === "active" ? "enabled" : "disabled"}.`,
      "success"
    );


    await loadAdminUsers();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to change user status.",
      "error"
    );

  }

}


/* ============================================================
   ACCESS MODAL
============================================================ */

function openAccessModal(
  userId
) {

  const user =
    allUsers.find(
      u => u.id === userId
    );


  if (!user) {

    return;

  }


  $("modalContent").innerHTML = `

    <span class="eyebrow">
      PERMISSIONS
    </span>

    <h2>
      ${escapeHTML(
        user.full_name ||
        "User"
      )}
    </h2>

    <p>
      Select which annotation environments
      this user may access.
    </p>


    <div
      style="
        display:grid;
        gap:10px;
        margin:20px 0;
      "
    >

      <label
        style="
          display:flex;
          gap:10px;
          align-items:center;
          padding:15px;
          border:1px solid rgba(255,255,255,.08);
          border-radius:10px;
        "
      >

        <input
          id="access2d"
          type="checkbox"
          ${
            user.access_2d
              ? "checked"
              : ""
          }
        >

        <span>
          <strong>2D Camera</strong>
          <small
            style="
              display:block;
              margin-top:3px;
              color:#64748b;
            "
          >
            Seven-camera 2D annotation
          </small>
        </span>

      </label>


      <label
        style="
          display:flex;
          gap:10px;
          align-items:center;
          padding:15px;
          border:1px solid rgba(255,255,255,.08);
          border-radius:10px;
        "
      >

        <input
          id="access3d"
          type="checkbox"
          ${
            user.access_3d
              ? "checked"
              : ""
          }
        >

        <span>
          <strong>3D LiDAR</strong>
          <small
            style="
              display:block;
              margin-top:3px;
              color:#64748b;
            "
          >
            LiDAR cuboid annotation
          </small>
        </span>

      </label>

    </div>


    <button
      id="saveAccessButton"
      class="primary-button"
      style="width:100%;"
    >
      Save permissions
    </button>

  `;


  $("saveAccessButton")
    .addEventListener(
      "click",
      () =>
        saveUserAccess(
          userId
        )
    );


  openModal();

}


async function saveUserAccess(
  userId
) {

  const access2d =
    $("access2d").checked;

  const access3d =
    $("access3d").checked;


  try {

    const {
      error
    } =
      await supabaseClient
        .from("profiles")
        .update({
          access_2d: access2d,
          access_3d: access3d
        })
        .eq(
          "id",
          userId
        );


    if (error) {

      throw error;

    }


    await logAdminAudit(
      "access_changed",
      userId,
      `2D=${access2d}, 3D=${access3d}`
    );


    closeModal();


    showToast(
      "Access permissions updated.",
      "success"
    );


    await loadAdminUsers();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to update access.",
      "error"
    );

  }

}


/* ============================================================
   CREATE TASK
============================================================ */

async function createTask(
  event
) {

  event.preventDefault();


  const name =
    $("taskName")
      .value
      .trim();

  const type =
    $("taskType")
      .value;

  const assignee =
    $("taskAssignee")
      .value ||
      null;

  const link =
    $("taskLink")
      .value
      .trim() ||
      null;

  const description =
    $("taskDescription")
      .value
      .trim();


  if (!name) {

    showToast(
      "Enter a task name.",
      "error"
    );

    return;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("tasks")
        .insert({
          name,
          task_type: type,
          assigned_to: assignee,
          status: "assigned",
          description,
          task_link: link,
          created_by: currentUser.id
        })
        .select()
        .single();


    if (error) {

      throw error;

    }


    await logActivity(
      "created_task",
      data.id,
      `Created task ${name}`
    );


    $("createTaskForm")
      .reset();


    showToast(
      "Task created successfully.",
      "success"
    );


    await loadAdminTasks();


    await loadTasks();


  } catch (error) {

    console.error(
      "Create task error:",
      error
    );

    showToast(
      error.message ||
      "Unable to create task.",
      "error"
    );

  }

}


/* ============================================================
   ASSIGNEE SELECT
============================================================ */

function populateAssigneeSelect(
  users
) {

  const select =
    $("taskAssignee");


  select.innerHTML =
    `<option value="">
      Select worker
    </option>`;


  users
    .filter(
      user =>
        user.status === "active" &&
        (
          user.role === "worker" ||
          user.role === "coworker" ||
          user.role === "reviewer"
        )
    )
    .forEach(
      user => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          user.id;


        option.textContent =
          `${user.full_name || "User"} — ${user.email || ""}`;


        select.appendChild(
          option
        );

      }
    );

}


/* ============================================================
   ADMIN TASKS
============================================================ */

async function loadAdminTasks() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("tasks")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      throw error;

    }


    const container =
      $("adminTasksTable");


    container.innerHTML = `

      <div class="user-row header">

        <div>Task</div>
        <div>Type</div>
        <div>Status</div>
        <div>Assigned</div>
        <div>Action</div>

      </div>

    `;


    (data || [])
      .forEach(
        task => {

          const row =
            document.createElement(
              "div"
            );


          row.className =
            "user-row";


          const assigned =
            allUsers.find(
              u =>
                u.id === task.assigned_to
            );


          row.innerHTML = `

            <div>
              <strong>
                ${escapeHTML(
                  task.name ||
                  "Task"
                )}
              </strong>
            </div>

            <div>
              ${escapeHTML(
                String(
                  task.task_type ||
                  ""
                ).toUpperCase()
              )}
            </div>

            <div>
              ${escapeHTML(
                task.status ||
                "assigned"
              )}
            </div>

            <div>
              ${
                assigned
                  ? escapeHTML(
                      assigned.full_name ||
                      assigned.email
                    )
                  : "Unassigned"
              }
            </div>

            <div>

              <button
                class="small-button danger"
                data-delete-task="${task.id}"
              >
                Delete
              </button>

            </div>

          `;


          row.querySelector(
            "[data-delete-task]"
          ).addEventListener(
            "click",
            () =>
              deleteTask(
                task.id
              )
          );


          container.appendChild(
            row
          );

        }
      );


  } catch (error) {

    console.error(error);

  }

}


/* ============================================================
   DELETE TASK
============================================================ */

async function deleteTask(
  taskId
) {

  if (
    !confirm(
      "Delete this task?"
    )
  ) {

    return;

  }


  try {

    const {
      error
    } =
      await supabaseClient
        .from("tasks")
        .delete()
        .eq(
          "id",
          taskId
        );


    if (error) {

      throw error;

    }


    showToast(
      "Task deleted.",
      "success"
    );


    await loadAdminTasks();

    await loadTasks();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to delete task.",
      "error"
    );

  }

}


/* ============================================================
   ACCESS REQUESTS
============================================================ */

async function loadAccessRequests() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("access_requests")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      console.warn(
        "Access request error:",
        error
      );

      return;

    }


    const container =
      $("requestsTable");


    container.innerHTML =
      "";


    if (
      !data ||
      !data.length
    ) {

      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✓</div>
          <h3>No access requests</h3>
          <p>There are no pending requests.</p>
        </div>
      `;

      return;

    }


    data.forEach(
      request => {

        const row =
          document.createElement(
            "div"
          );


        row.className =
          "user-row";


        row.style.gridTemplateColumns =
          "2fr 1fr 1fr 1.5fr";


        row.innerHTML = `

          <div>

            <strong>
              ${escapeHTML(
                request.email ||
                "Unknown"
              )}
            </strong>

            <div
              style="
                color:#64748b;
                margin-top:3px;
                font-size:8px;
              "
            >
              ${escapeHTML(
                request.message ||
                ""
              )}
            </div>

          </div>

          <div>
            ${escapeHTML(
              request.requested_role ||
              "worker"
            )}
          </div>

          <div>
            ${escapeHTML(
              request.status ||
              "pending"
            )}
          </div>

          <div>

            ${
              request.status === "pending"
                ? `
                  <button
                    class="small-button"
                    data-approve="${request.id}"
                  >
                    Approve
                  </button>

                  <button
                    class="small-button danger"
                    data-reject="${request.id}"
                  >
                    Reject
                  </button>
                `
                : "Processed"
            }

          </div>

        `;


        const approve =
          row.querySelector(
            "[data-approve]"
          );


        if (approve) {

          approve.addEventListener(
            "click",
            () =>
              processRequest(
                request.id,
                "approved"
              )
          );

        }


        const reject =
          row.querySelector(
            "[data-reject]"
          );


        if (reject) {

          reject.addEventListener(
            "click",
            () =>
              processRequest(
                request.id,
                "rejected"
              )
          );

        }


        container.appendChild(
          row
        );

      }
    );


  } catch (error) {

    console.error(error);

  }

}


/* ============================================================
   PROCESS REQUEST
============================================================ */

async function processRequest(
  requestId,
  status
) {

  try {

    const {
      error
    } =
      await supabaseClient
        .from("access_requests")
        .update({
          status,
          reviewed_by: currentUser.id,
          reviewed_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          requestId
        );


    if (error) {

      throw error;

    }


    showToast(
      `Request ${status}.`,
      "success"
    );


    await loadAccessRequests();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Unable to process request.",
      "error"
    );

  }

}


/* ============================================================
   ADMIN AUDIT
============================================================ */

async function logAdminAudit(
  action,
  targetUser,
  description
) {

  try {

    await supabaseClient
      .from("activity_logs")
      .insert({
        user_id: currentUser.id,
        action,
        description:
          `${description} (${targetUser})`
      });

  } catch (error) {

    console.warn(error);

  }

}


/* ============================================================
   MODAL
============================================================ */

function openModal() {

  $("modalOverlay")
    .classList
    .remove("hidden");

}


$("closeModal")
  .addEventListener(
    "click",
    closeModal
  );


$("modalOverlay")
  .addEventListener(
    "click",
    event => {

      if (
        event.target ===
        $("modalOverlay")
      ) {

        closeModal();

      }

    }
  );


function closeModal() {

  $("modalOverlay")
    .classList
    .add("hidden");

}


/* ============================================================
   TOAST
============================================================ */

function showToast(
  message,
  type = "success"
) {

  const toast =
    $("toast");


  $("toastText")
    .textContent =
      message;


  $("toastIcon")
    .textContent =
      type === "error"
        ? "!"
        : "✓";


  toast
    .classList
    .remove("hidden");


  clearTimeout(
    window.toastTimer
  );


  window.toastTimer =
    setTimeout(
      () => {

        toast
          .classList
          .add("hidden");

      },
      3500
    );

}


/* ============================================================
   LOGOUT
============================================================ */

async function logout() {

  try {

    await supabaseClient
      .auth
      .signOut();

  } catch (error) {

    console.error(error);

  }


  currentUser = null;

  currentProfile = null;

  showLoginScreen();

}


/* ============================================================
   HELPERS
============================================================ */

function formatDateTime(
  value
) {

  if (!value) {

    return "";

  }


  return new Date(value)
    .toLocaleString();

}


function escapeHTML(value) {

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
