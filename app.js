/* =========================================================
   AI TRAINER EXPERT
   SUPABASE AUTH + DASHBOARD
========================================================= */

"use strict";


/* =========================================================
   SUPABASE CONFIG
========================================================= */

const SUPABASE_URL =
  "https://mlmldgwzvkpprwkmfdlh.supabase.co";


const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_8WucrYYIhnr1EXdNMkdMsQ_vFtZecB2";


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  );


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let currentProfile = null;
let currentSession = null;


/*
 * Important:
 * We DO NOT put the administrator's email here.
 *
 * Admin status comes from:
 *
 * profiles.role = "admin"
 *
 * This means normal users do not see an admin email
 * inside the frontend code.
 */


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (id) =>
  document.getElementById(id);


function show(el) {

  if (!el) return;

  el.classList.remove("hidden");
}


function hide(el) {

  if (!el) return;

  el.classList.add("hidden");
}


function setMessage(
  element,
  message,
  type = "info"
) {

  if (!element) return;

  element.textContent = message;

  element.className =
    `message ${type}`;

}


function clearMessage(element) {

  if (!element) return;

  element.textContent = "";

  element.className =
    "message hidden";

}


/* =========================================================
   TOAST
========================================================= */

function toast(
  message,
  type = "info"
) {

  const el = $("toast");

  if (!el) return;

  el.textContent = message;

  el.classList.remove("hidden");

  if (type === "error") {
    el.style.borderColor =
      "rgba(239,68,68,.35)";
  } else if (type === "success") {
    el.style.borderColor =
      "rgba(34,197,94,.35)";
  } else {
    el.style.borderColor =
      "rgba(139,92,246,.35)";
  }

  clearTimeout(window.__toastTimer);

  window.__toastTimer =
    setTimeout(() => {

      el.classList.add("hidden");

    }, 4000);
}


/* =========================================================
   URL FOR PASSWORD RESET
========================================================= */

function getResetRedirectURL() {

  /*
   * Works on GitHub Pages and local hosting.
   *
   * Example:
   * https://username.github.io/repository/
   */

  return (
    window.location.origin +
    window.location.pathname
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  console.log(
    "AI TRAINER EXPERT starting..."
  );

  bindEvents();

  updateDate();

  updateGreeting();


  /*
   * First check if there is an existing
   * Supabase session.
   */

  const {
    data,
    error
  } =
    await supabaseClient.auth.getSession();


  if (error) {

    console.error(
      "Session error:",
      error
    );

    showLogin();

    return;
  }


  if (data?.session) {

    console.log(
      "Existing session detected."
    );

    await handleAuthenticatedSession(
      data.session
    );

  } else {

    console.log(
      "No active session."
    );

    showLogin();

  }


  /*
   * Listen for login/logout/password events.
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

        /*
         * Do not perform complicated
         * Supabase calls directly inside
         * the callback.
         */

        setTimeout(
          () =>
            handleAuthenticatedSession(
              session
            ),
          0
        );

      }


      if (
        event === "SIGNED_OUT"
      ) {

        currentUser = null;
        currentProfile = null;
        currentSession = null;

        showLogin();

      }


      if (
        event === "PASSWORD_RECOVERY"
      ) {

        showPasswordRecovery();

      }

    }
  );

}


/* =========================================================
   EVENT BINDINGS
========================================================= */

function bindEvents() {

  const loginForm =
    $("loginForm");

  if (loginForm) {

    loginForm.addEventListener(
      "submit",
      handleLogin
    );

  }


  const forgotButton =
    $("forgotPasswordButton");

  if (forgotButton) {

    forgotButton.addEventListener(
      "click",
      showForgotPassword
    );

  }


  const backButton =
    $("backToLogin");

  if (backButton) {

    backButton.addEventListener(
      "click",
      showLogin
    );

  }


  const forgotForm =
    $("forgotForm");

  if (forgotForm) {

    forgotForm.addEventListener(
      "submit",
      handleForgotPassword
    );

  }


  const newPasswordForm =
    $("newPasswordForm");

  if (newPasswordForm) {

    newPasswordForm.addEventListener(
      "submit",
      handleNewPassword
    );

  }


  const toggle =
    $("togglePassword");

  if (toggle) {

    toggle.addEventListener(
      "click",
      () => {

        const input =
          $("loginPassword");

        if (!input) return;

        if (
          input.type === "password"
        ) {

          input.type = "text";

          toggle.textContent = "◌";

        } else {

          input.type = "password";

          toggle.textContent = "◉";

        }

      }
    );

  }


  const logout =
    $("logoutButton");

  if (logout) {

    logout.addEventListener(
      "click",
      handleLogout
    );

  }


  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const view =
            button.dataset.view;

          navigate(view);

        }
      );

    });


  const refresh =
    $("refreshUsersButton");

  if (refresh) {

    refresh.addEventListener(
      "click",
      loadAdminUsers
    );

  }

}


/* =========================================================
   LOGIN
========================================================= */

async function handleLogin(event) {

  event.preventDefault();


  const email =
    $("loginEmail")
      ?.value
      ?.trim()
      ?.toLowerCase();


  const password =
    $("loginPassword")
      ?.value;


  const message =
    $("loginMessage");


  clearMessage(message);


  if (!email) {

    setMessage(
      message,
      "Please enter your email address.",
      "error"
    );

    return;
  }


  if (!password) {

    setMessage(
      message,
      "Please enter your password.",
      "error"
    );

    return;
  }


  const button =
    $("loginButton");


  const buttonText =
    $("loginButtonText");


  const spinner =
    $("loginSpinner");


  if (button) {
    button.disabled = true;
  }


  if (buttonText) {
    buttonText.textContent =
      "Signing in...";
  }


  show(spinner);


  console.log(
    "Attempting Supabase authentication..."
  );


  try {

    /*
     * This is the correct Supabase v2
     * password login method.
     */

    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });


    if (error) {

      console.error(
        "Supabase login error:",
        error
      );


      const friendly =
        getLoginErrorMessage(error);


      setMessage(
        message,
        friendly,
        "error"
      );


      return;
    }


    if (!data?.session) {

      setMessage(
        message,
        "Login completed but no session was created. Please try again.",
        "error"
      );

      return;
    }


    console.log(
      "Supabase authentication successful."
    );


    currentSession =
      data.session;

    currentUser =
      data.user;


    /*
     * Profile/access check happens
     * AFTER authentication.
     */

    await handleAuthenticatedSession(
      data.session
    );


  } catch (error) {

    console.error(
      "Unexpected login error:",
      error
    );


    setMessage(
      message,
      "Unable to contact the authentication service. Check your internet connection and try again.",
      "error"
    );


  } finally {

    if (button) {
      button.disabled = false;
    }

    if (buttonText) {
      buttonText.textContent =
        "Sign in";
    }

    hide(spinner);

  }

}


/* =========================================================
   LOGIN ERROR HANDLING
========================================================= */

function getLoginErrorMessage(error) {

  const message =
    String(
      error?.message || ""
    ).toLowerCase();


  if (
    message.includes(
      "invalid login credentials"
    )
  ) {

    return (
      "Incorrect email or password. " +
      "If you have forgotten your password, click " +
      "\"Forgot password?\" below."
    );

  }


  if (
    message.includes(
      "email not confirmed"
    )
  ) {

    return (
      "Your email has not been confirmed yet. " +
      "Check your email for the Supabase confirmation message."
    );

  }


  if (
    message.includes(
      "too many requests"
    )
  ) {

    return (
      "Too many login attempts. Please wait a few minutes and try again."
    );

  }


  if (
    message.includes(
      "failed to fetch"
    )
  ) {

    return (
      "The website could not reach Supabase. " +
      "Check your internet connection and make sure the Supabase project is online."
    );

  }


  return (
    error?.message ||
    "Unable to sign in. Please try again."
  );

}


/* =========================================================
   FORGOT PASSWORD
========================================================= */

function showForgotPassword() {

  hide($("loginView"));
  hide($("newPasswordView"));

  show($("forgotView"));


  const email =
    $("loginEmail")
      ?.value
      ?.trim();


  if (
    email &&
    $("forgotEmail")
  ) {

    $("forgotEmail").value =
      email;

  }


  clearMessage(
    $("forgotMessage")
  );

}


async function handleForgotPassword(event) {

  event.preventDefault();


  const email =
    $("forgotEmail")
      ?.value
      ?.trim()
      ?.toLowerCase();


  const message =
    $("forgotMessage");


  clearMessage(message);


  if (!email) {

    setMessage(
      message,
      "Enter your email address.",
      "error"
    );

    return;
  }


  const button =
    $("resetButton");


  const text =
    $("resetButtonText");


  const spinner =
    $("resetSpinner");


  button.disabled = true;

  text.textContent =
    "Sending...";

  show(spinner);


  try {

    const redirectTo =
      getResetRedirectURL();


    console.log(
      "Password reset redirect:",
      redirectTo
    );


    const {
      error
    } =
      await supabaseClient.auth
        .resetPasswordForEmail(
          email,
          {
            redirectTo
          }
        );


    if (error) {

      console.error(
        "Password reset error:",
        error
      );


      setMessage(
        message,
        error.message ||
        "Unable to send password reset email.",
        "error"
      );

      return;
    }


    /*
     * Supabase intentionally does not
     * reveal whether an account exists.
     */

    setMessage(
      message,
      "If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.",
      "success"
    );


  } catch (error) {

    console.error(
      error
    );


    setMessage(
      message,
      "Unable to send the reset email. Please try again.",
      "error"
    );


  } finally {

    button.disabled = false;

    text.textContent =
      "Send reset link";

    hide(spinner);

  }

}


/* =========================================================
   PASSWORD RECOVERY PAGE
========================================================= */

function showPasswordRecovery() {

  hide($("loginView"));
  hide($("forgotView"));

  show($("newPasswordView"));

  clearMessage(
    $("newPasswordMessage")
  );

}


/* =========================================================
   UPDATE PASSWORD
========================================================= */

async function handleNewPassword(event) {

  event.preventDefault();


  const password =
    $("newPassword")
      ?.value;


  const confirmation =
    $("confirmPassword")
      ?.value;


  const message =
    $("newPasswordMessage");


  clearMessage(message);


  if (
    !password ||
    password.length < 8
  ) {

    setMessage(
      message,
      "Password must contain at least 8 characters.",
      "error"
    );

    return;
  }


  if (
    password !== confirmation
  ) {

    setMessage(
      message,
      "The passwords do not match.",
      "error"
    );

    return;
  }


  const button =
    $("updatePasswordButton");


  button.disabled = true;

  button.textContent =
    "Updating...";


  try {

    const {
      error
    } =
      await supabaseClient.auth
        .updateUser({
          password
        });


    if (error) {

      console.error(
        "Update password error:",
        error
      );


      setMessage(
        message,
        error.message ||
        "Unable to update password.",
        "error"
      );

      return;
    }


    setMessage(
      message,
      "Password updated successfully. You can now sign in with your new password.",
      "success"
    );


    setTimeout(
      async () => {

        await supabaseClient.auth.signOut();

        showLogin();

      },
      1800
    );


  } catch (error) {

    console.error(
      error
    );


    setMessage(
      message,
      "Unable to update your password.",
      "error"
    );


  } finally {

    button.disabled = false;

    button.textContent =
      "Update password";

  }

}


/* =========================================================
   AUTHENTICATED SESSION
========================================================= */

async function handleAuthenticatedSession(
  session
) {

  if (!session?.user) {

    showLogin();

    return;
  }


  currentSession =
    session;

  currentUser =
    session.user;


  console.log(
    "Authenticated user:",
    currentUser.id
  );


  /*
   * Get profile from our profiles table.
   */

  const profileResult =
    await loadUserProfile(
      currentUser.id
    );


  if (
    !profileResult
  ) {

    await supabaseClient.auth.signOut();


    setMessage(
      $("loginMessage"),
      "Your account is authenticated, but no active AI TRAINER EXPERT profile was found. Ask an administrator to activate your account.",
      "error"
    );


    showLogin();

    return;
  }


  currentProfile =
    profileResult;


  /*
   * ACCESS CONTROL
   */

  const status =
    String(
      currentProfile.status ||
      ""
    ).toLowerCase();


  const role =
    String(
      currentProfile.role ||
      ""
    ).toLowerCase();


  const isAdmin =
    role === "admin";


  const isActive =
    status === "active" ||
    isAdmin;


  if (!isActive) {

    await supabaseClient.auth.signOut();


    setMessage(
      $("loginMessage"),
      getAccessDeniedMessage(
        currentProfile
      ),
      "error"
    );


    showLogin();

    return;
  }


  /*
   * User is authenticated AND
   * authorized.
   */

  populateUserUI();

  showApp();


  await loadDashboard();

}


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadUserProfile(
  userId
) {

  try {

    /*
     * Main project table:
     * profiles
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .from("profiles")
        .select(
          `
          id,
          email,
          full_name,
          role,
          status,
          access_2d,
          access_3d,
          company_name
          `
        )
        .eq(
          "id",
          userId
        )
        .maybeSingle();


    if (error) {

      console.error(
        "Profile lookup error:",
        error
      );

      return null;
    }


    return data;

  } catch (error) {

    console.error(
      "Profile exception:",
      error
    );

    return null;
  }

}


/* =========================================================
   ACCESS DENIED MESSAGE
========================================================= */

function getAccessDeniedMessage(
  profile
) {

  const status =
    String(
      profile?.status || ""
    ).toLowerCase();


  if (
    status === "waitlist"
  ) {

    return (
      "Your account is on the waiting list. " +
      "An administrator must approve your access before you can enter."
    );

  }


  if (
    status === "suspended"
  ) {

    return (
      "Your account has been suspended. " +
      "Please contact an administrator."
    );

  }


  return (
    "Your account has not been activated for AI TRAINER EXPERT yet."
  );

}


/* =========================================================
   SHOW LOGIN
========================================================= */

function showLogin() {

  hide($("appScreen"));

  show($("authScreen"));

  hide($("forgotView"));
  hide($("newPasswordView"));

  show($("loginView"));

}


/* =========================================================
   SHOW APP
========================================================= */

function showApp() {

  hide($("authScreen"));

  show($("appScreen"));

}


/* =========================================================
   POPULATE USER UI
========================================================= */

function populateUserUI() {

  const name =
    currentProfile?.full_name ||
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split("@")[0] ||
    "User";


  const email =
    currentUser?.email ||
    currentProfile?.email ||
    "";


  const role =
    currentProfile?.role ||
    "coworker";


  const company =
    currentProfile?.company_name ||
    "AI TRAINER EXPERT";


  const initials =
    getInitials(name);


  if ($("welcomeName"))
    $("welcomeName").textContent =
      name;


  if ($("sidebarUserName"))
    $("sidebarUserName").textContent =
      name;


  if ($("sidebarUserRole"))
    $("sidebarUserRole").textContent =
      formatRole(role);


  if ($("topUserName"))
    $("topUserName").textContent =
      name;


  if ($("topUserEmail"))
    $("topUserEmail").textContent =
      email;


  if ($("sidebarAvatar"))
    $("sidebarAvatar").textContent =
      initials;


  if ($("topAvatar"))
    $("topAvatar").textContent =
      initials;


  /*
   * Company name is taken from the
   * profile rather than exposing
   * administrator information.
   */

  const companyTitle =
    document.querySelector(
      ".company-title"
    );


  if (companyTitle) {

    companyTitle.textContent =
      company;

  }


  /*
   * Admin menu is controlled by
   * database role.
   */

  const adminButtons =
    document.querySelectorAll(
      ".admin-only"
    );


  adminButtons.forEach(button => {

    if (
      String(role).toLowerCase() ===
      "admin"
    ) {

      show(button);

    } else {

      hide(button);

    }

  });


  $("access2d").textContent =
    currentProfile?.access_2d
      ? "YES"
      : "NO";


  $("access3d").textContent =
    currentProfile?.access_3d
      ? "YES"
      : "NO";

}


/* =========================================================
   INITIALS
========================================================= */

function getInitials(
  name
) {

  const parts =
    String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean);


  if (!parts.length)
    return "U";


  if (parts.length === 1)
    return parts[0]
      .substring(0, 2)
      .toUpperCase();


  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();

}


/* =========================================================
   ROLE FORMAT
========================================================= */

function formatRole(
  role
) {

  return String(role)
    .replaceAll("_", " ")
    .replace(/\b\w/g, c =>
      c.toUpperCase()
    );

}


/* =========================================================
   GREETING
========================================================= */

function updateGreeting() {

  const hour =
    new Date().getHours();


  let greeting =
    "GOOD DAY";


  if (hour < 12) {

    greeting =
      "GOOD MORNING";

  } else if (hour < 18) {

    greeting =
      "GOOD AFTERNOON";

  } else {

    greeting =
      "GOOD EVENING";

  }


  if ($("timeGreeting")) {

    $("timeGreeting").textContent =
      greeting;

  }

}


/* =========================================================
   DATE
========================================================= */

function updateDate() {

  const date =
    new Date();


  if ($("currentDate")) {

    $("currentDate").textContent =
      date.toLocaleDateString(
        undefined,
        {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric"
        }
      );

  }

}


/* =========================================================
   NAVIGATION
========================================================= */

function navigate(
  view
) {

  const views = [
    "dashboard",
    "tasks",
    "activity",
    "admin"
  ];


  views.forEach(name => {

    const element =
      $(`${name}View`);

    if (!element)
      return;


    if (name === view) {

      show(element);

    } else {

      hide(element);

    }

  });


  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.view === view
      );

    });


  if (view === "tasks") {

    loadTasks();

  }


  if (view === "activity") {

    loadActivity();

  }


  if (view === "admin") {

    if (
      currentProfile?.role !==
      "admin"
    ) {

      toast(
        "Administrator access required.",
        "error"
      );

      navigate("dashboard");

      return;
    }


    loadAdminUsers();

  }

}


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {

  await loadTasks();

}


/* =========================================================
   TASKS
========================================================= */

async function loadTasks() {

  const containers = [
    $("taskList"),
    $("allTasksList")
  ];


  containers.forEach(container => {

    if (container) {

      container.innerHTML = `
        <div class="loading-card">
          <div class="loading-spinner"></div>
          <p>Loading your work...</p>
        </div>
      `;

    }

  });


  /*
   * The schema uses task_assignments.
   *
   * We retrieve assignments for the
   * currently logged-in user.
   */

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("task_assignments")
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
        );


    if (error) {

      console.error(
        "Task loading error:",
        error
      );


      renderEmptyTasks(
        "No work is available right now. We are working hard to give you more work."
      );


      return;
    }


    const tasks =
      data || [];


    $("assignedCount").textContent =
      tasks.length;


    renderTasks(
      $("taskList"),
      tasks
    );


    renderTasks(
      $("allTasksList"),
      tasks
    );


  } catch (error) {

    console.error(
      error
    );


    renderEmptyTasks(
      "No work is available right now. We are working hard to give you more work."
    );

  }

}


/* =========================================================
   RENDER TASKS
========================================================= */

function renderTasks(
  container,
  tasks
) {

  if (!container)
    return;


  if (!tasks.length) {

    container.innerHTML = `
      <div class="empty-card">
        <strong>Working hard to give you more work.</strong>
        <br><br>
        <span>
          There are no tasks currently assigned to you.
        </span>
      </div>
    `;

    return;
  }


  container.innerHTML =
    tasks.map(
      task => {

        const taskName =
          task.task_name ||
          task.name ||
          task.title ||
          "Annotation Task";


        const type =
          String(
            task.task_type ||
            task.type ||
            "2D"
          ).toUpperCase();


        const status =
          String(
            task.status ||
            "assigned"
          );


        return `
          <article class="task-card">

            <div class="task-info">

              <h3>
                ${escapeHTML(taskName)}
              </h3>

              <p>
                Assigned annotation task
              </p>

              <div class="task-meta">

                <span class="task-tag ${type === "3D"
                  ? "purple"
                  : "blue"}">
                  ${escapeHTML(type)}
                </span>

                <span class="task-tag green">
                  ${escapeHTML(status)}
                </span>

              </div>

            </div>


            <button
              class="claim-button"
              data-task-id="${escapeHTML(
                task.task_id ||
                task.id ||
                ""
              )}"
              data-task-type="${escapeHTML(type)}"
            >
              Start task
            </button>

          </article>
        `;

      }
    )
    .join("");


  container
    .querySelectorAll(".claim-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          startTask(
            button.dataset.taskId,
            button.dataset.taskType
          );

        }
      );

    });

}


/* =========================================================
   EMPTY TASKS
========================================================= */

function renderEmptyTasks(
  message
) {

  const html = `
    <div class="empty-card">
      ${escapeHTML(message)}
    </div>
  `;


  if ($("taskList"))
    $("taskList").innerHTML =
      html;


  if ($("allTasksList"))
    $("allTasksList").innerHTML =
      html;


  if ($("assignedCount"))
    $("assignedCount").textContent =
      "0";

}


/* =========================================================
   START TASK
========================================================= */

async function startTask(
  taskId,
  taskType
) {

  if (!taskId) {

    toast(
      "This task does not have a valid task ID.",
      "error"
    );

    return;
  }


  const type =
    String(taskType)
      .toUpperCase();


  /*
   * HARD ACCESS CHECK
   *
   * A 3D user without 3D access
   * cannot open a 3D task.
   */

  if (
    type === "3D" &&
    !currentProfile?.access_3d
  ) {

    toast(
      "3D access has not been granted to your account.",
      "error"
    );

    return;
  }


  if (
    type === "2D" &&
    !currentProfile?.access_2d
  ) {

    toast(
      "2D access has not been granted to your account.",
      "error"
    );

    return;
  }


  /*
   * Store a short-lived task launch
   * record in sessionStorage.
   */

  sessionStorage.setItem(
    "aiTrainerTask",
    JSON.stringify({
      taskId,
      taskType: type,
      userId: currentUser.id
    })
  );


  /*
   * Workspace page.
   */

  window.location.href =
    "workspace.html";

}


/* =========================================================
   ACTIVITY
========================================================= */

async function loadActivity() {

  const container =
    $("activityList");


  if (!container)
    return;


  container.innerHTML = `
    <div class="loading-card">
      <div class="loading-spinner"></div>
      <p>Loading activity...</p>
    </div>
  `;


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("audit_log")
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
        .limit(20);


    if (error) {

      console.error(
        "Activity error:",
        error
      );


      container.innerHTML =
        `<div class="empty-card">
          No recent activity.
        </div>`;

      return;
    }


    if (!data?.length) {

      container.innerHTML =
        `<div class="empty-card">
          No recent activity.
        </div>`;

      return;
    }


    container.innerHTML =
      data.map(
        item => {

          return `
            <div class="activity-item">

              <strong>
                ${escapeHTML(
                  item.action ||
                  item.event ||
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

        }
      ).join("");


  } catch (error) {

    console.error(
      error
    );


    container.innerHTML =
      `<div class="empty-card">
        No recent activity.
      </div>`;

  }

}


/* =========================================================
   ADMIN USERS
========================================================= */

async function loadAdminUsers() {

  if (
    currentProfile?.role !==
    "admin"
  ) {

    toast(
      "Administrator access required.",
      "error"
    );

    return;
  }


  const container =
    $("adminUsersList");


  if (!container)
    return;


  container.innerHTML = `
    <div class="loading-card">
      <div class="loading-spinner"></div>
      <p>Loading team members...</p>
    </div>
  `;


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("profiles")
        .select(
          `
          id,
          email,
          full_name,
          role,
          status,
          access_2d,
          access_3d,
          company_name
          `
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        "Admin users error:",
        error
      );


      container.innerHTML =
        `<div class="empty-card">
          Unable to load team members.
        </div>`;

      return;
    }


    if (!data?.length) {

      container.innerHTML =
        `<div class="empty-card">
          No team members found.
        </div>`;

      return;
    }


    container.innerHTML =
      data.map(
        user => {

          const initials =
            getInitials(
              user.full_name ||
              user.email ||
              "U"
            );


          return `
            <div class="admin-user">

              <div class="admin-user-main">

                <div class="avatar">
                  ${escapeHTML(initials)}
                </div>

                <div class="admin-user-name">

                  <strong>
                    ${escapeHTML(
                      user.full_name ||
                      "Unnamed user"
                    )}
                  </strong>

                  <span>
                    ${escapeHTML(
                      user.email || ""
                    )}
                  </span>

                </div>

              </div>


              <div class="admin-user-badges">

                <span
                  class="badge"
                  style="
                    background:rgba(139,92,246,.1);
                    color:#c4b5fd;
                  "
                >
                  ${escapeHTML(
                    user.role ||
                    "coworker"
                  )}
                </span>


                <span
                  class="badge"
                  style="
                    background:rgba(34,197,94,.1);
                    color:#86efac;
                  "
                >
                  ${escapeHTML(
                    user.status ||
                    "unknown"
                  )}
                </span>


                ${
                  user.access_2d
                    ? `
                      <span
                        class="badge"
                        style="
                          background:rgba(56,189,248,.1);
                          color:#7dd3fc;
                        "
                      >
                        2D
                      </span>
                    `
                    : ""
                }


                ${
                  user.access_3d
                    ? `
                      <span
                        class="badge"
                        style="
                          background:rgba(245,158,11,.1);
                          color:#fcd34d;
                        "
                      >
                        3D
                      </span>
                    `
                    : ""
                }

              </div>

            </div>
          `;

        }
      ).join("");


  } catch (error) {

    console.error(
      error
    );


    container.innerHTML =
      `<div class="empty-card">
        Unable to load team members.
      </div>`;

  }

}


/* =========================================================
   LOGOUT
========================================================= */

async function handleLogout() {

  try {

    const {
      error
    } =
      await supabaseClient.auth
        .signOut();


    if (error) {

      console.error(
        "Logout error:",
        error
      );

      return;
    }


    currentUser = null;
    currentProfile = null;
    currentSession = null;


    sessionStorage.removeItem(
      "aiTrainerTask"
    );


    showLogin();


  } catch (error) {

    console.error(
      error
    );

  }

}


/* =========================================================
   SECURITY HELPERS
========================================================= */

function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function formatDateTime(
  value
) {

  if (!value)
    return "";


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";

  }


  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );

}
