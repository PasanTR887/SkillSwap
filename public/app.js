const API = (path) => `${location.origin}${path}`;

// ---- AUTH helpers ----
function getAuth() {
  const raw = localStorage.getItem("skillswap_auth");
  return raw ? JSON.parse(raw) : null; // { token, user }
}

function getToken() {
  const auth = getAuth();
  return auth?.token || "";
}

async function renderUserNav() {
  const auth = await ensureLogin();
  const role = auth.user.role; // "seller" or "client"
  const name = auth.user.name;

  const el = document.getElementById("userNav");
  if (!el) return;

  const badgeClass = role === "seller" ? "bg-success" : "bg-warning";

  el.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <a class="btn btn-light btn-sm" href="/">Marketplace</a>
      <a class="btn btn-light btn-sm" href="/dashboard.html">Dashboard</a>
      ${role === "seller" ? `<a class="btn btn-light btn-sm" href="/post-skill.html">Seller Panel</a>` : ""}

      <span class="text-white small d-none d-md-inline">Hi, <b>${name}</b></span>
      <span class="badge ${badgeClass} text-uppercase">${role}</span>

      <button class="btn btn-light btn-sm" onclick="logout()">Logout</button>
    </div>
  `;
}


async function guardSellerPage() {
  const auth = await ensureLogin();
  if (auth.user.role !== "seller") {
    alert("Only sellers can access the Seller Panel.");
    window.location.href = "/";
  }
}



async function ensureLogin() {
  const auth = getAuth();
  if (auth?.token && auth?.user) return auth;
  window.location.href = "/login.html";
  throw new Error("Not logged in");
}

function authHeaders(extra = {}) {
  // include token for future backend protection
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

function logout() {
  localStorage.removeItem("skillswap_auth");
  window.location.href = "/login.html";
}
window.logout = logout;

// ---- UI helpers ----
function badgeForStatus(status) {
  if (status === "pending") return `<span class="badge bg-warning">pending</span>`;
  if (status === "accepted") return `<span class="badge bg-success">accepted</span>`;
  if (status === "completed") return `<span class="badge bg-success">completed</span>`;
  return `<span class="badge bg-danger">rejected</span>`;
}

function stars(avg) {
  const a = Number(avg || 0);
  const full = Math.round(a);
  let s = "";
  for (let i = 1; i <= 5; i++) s += i <= full ? "★" : "☆";
  return `<span style="color:#F59E0B;font-size:18px;">${s}</span> <span class="text-muted">(${a || 0})</span>`;
}

/* ---------------- HOME: browse skills ---------------- */
async function loadSkills() {
  initRequestModal();
  const auth = await ensureLogin();
  const myId = auth.user.userId;

  const q = document.getElementById("search")?.value || "";
  const cat = document.getElementById("category")?.value || "";

  const res = await fetch(
    API(`/api/skills?search=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`),
    { headers: authHeaders() }
  );
  const skills = await res.json();

  const container = document.getElementById("skillsList");
  if (!container) return;

  container.innerHTML = skills.map(s => {
    const isMine = String(s.userId?._id) === String(myId);

    const priceBadge = s.priceType === "Free"
      ? `<span class="badge bg-success">Free</span>`
      : `<span class="badge bg-warning">LKR ${s.price || 0}</span>`;

    return `
  <div class="col-md-6 col-lg-4">
    <div class="card p-3 h-100 shadow-sm skill-card">
      <div class="skill-head">
        <div class="d-flex justify-content-between align-items-center">
          <span class="pill">
            <span style="width:8px;height:8px;border-radius:999px;background:rgba(23, 52, 102, 0.9);display:inline-block;"></span>
            ${s.category}
          </span>

          ${
            s.priceType === "Free"
              ? `<span class="pill pill-free">FREE</span>`
              : `<span class="pill pill-paid">LKR ${s.price || 0}</span>`
          }
        </div>

        <div class="skill-title">${s.title}</div>

        <div class="skill-meta">
          <div>${stars(s.ratingAvg)} <span class="text-muted">• ${s.ratingCount || 0}</span></div>
          <div class="pill pill-price">
            ⏰ ${s.availability ? s.availability : "Flexible"}
          </div>
        </div>
      </div>

      <div class="skill-desc">
        ${(s.description || "No description provided.").slice(0, 140)}${(s.description || "").length > 140 ? "..." : ""}
      </div>

      <div class="skill-footer">
        <div class="skill-owner">
          <span class="text-muted">By</span> <b>${s.userId?.name || "Unknown"}</b>
        </div>

        <button class="btn btn-primary btn-sm skill-btn"
          ${isMine ? "disabled" : ""}
          onclick="requestSkill('${s._id}')">
          ${isMine ? "Your Skill" : "Request"}
        </button>
      </div>
    </div>
  </div>
`;

  }).join("");
}

let requestModalInstance = null;

function requestSkill(skillId) {
  // open modal and store skillId
  document.getElementById("reqSkillId").value = skillId;
  document.getElementById("reqMessage").value = "";
  document.getElementById("reqContactMethod").value = "WhatsApp";
  document.getElementById("reqContactValue").value = "";

  const err = document.getElementById("reqErr");
  if (err) {
    err.style.display = "none";
    err.textContent = "";
  }

  const modalEl = document.getElementById("requestModal");
  requestModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
  requestModalInstance.show();
}

function initRequestModal() {
  const form = document.getElementById("requestForm");
  if (!form) return; // not on index page

  // prevent double-binding
  if (form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const auth = await ensureLogin();

    const skillId = document.getElementById("reqSkillId").value;
    const message = (document.getElementById("reqMessage").value || "").trim();
    const contactMethod = document.getElementById("reqContactMethod").value;
    const contactValue = (document.getElementById("reqContactValue").value || "").trim();

    const err = document.getElementById("reqErr");
    err.style.display = "none";
    err.textContent = "";

    if (message.length < 5) {
      err.textContent = "Please describe your project (at least 5 characters).";
      err.style.display = "block";
      return;
    }

    const res = await fetch(API("/api/requests"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        skillId,
        requesterId: auth.user.userId,
        message: `${message}\n\nContact: ${contactMethod} - ${contactValue || "(not provided)"}`
      })
    });

    const data = await res.json();
    if (!res.ok) {
      err.textContent = data.error || "Failed to send request.";
      err.style.display = "block";
      return;
    }

    if (requestModalInstance) requestModalInstance.hide();
    alert("Request sent!");
  });
}



/* ---------------- POST SKILL ---------------- */
async function loadMySkills() {
  const auth = await ensureLogin();

  const res = await fetch(
    API(`/api/skills/mine?userId=${auth.user.userId}`),
    { headers: authHeaders() }
  );
  const skills = await res.json();

  const t = document.getElementById("mySkills");
  if (!t) return;

  t.innerHTML = skills.map(s => `
    <tr>
      <td>${s.title}</td>
      <td>${s.category}</td>
      <td>${s.priceType === "Free" ? "Free" : `LKR ${s.price || 0}`}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteSkill('${s._id}')">Delete</button></td>
    </tr>
  `).join("");
}

async function createSkill(e) {
  e.preventDefault();
  const auth = await ensureLogin();

  const title = document.getElementById("title").value;
  const category = document.getElementById("cat").value;
  const priceType = document.getElementById("priceType").value;
  const price = document.getElementById("price").value;
  const description = document.getElementById("desc").value;
  const availability = document.getElementById("avail").value;

  const res = await fetch(API("/api/skills"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      userId: auth.user.userId,
      title,
      category,
      priceType,
      price,
      description,
      availability
    })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "Failed");

  alert("Skill posted!");
  e.target.reset();
  document.getElementById("price").value = "";
  await loadMySkills();
}

async function deleteSkill(id) {
  const auth = await ensureLogin();
  if (!confirm("Delete this skill?")) return;

  const res = await fetch(
    API(`/api/skills/${id}?userId=${auth.user.userId}`),
    { method: "DELETE", headers: authHeaders() }
  );

  const data = await res.json();
  if (!res.ok) return alert(data.error || "Failed");
  await loadMySkills();
}

/* ---------------- DASHBOARD ---------------- */
async function loadIncoming() {
  const auth = await ensureLogin();

  const res = await fetch(
    API(`/api/requests/incoming?userId=${auth.user.userId}`),
    { headers: authHeaders() }
  );
  const list = await res.json();

  const t = document.getElementById("incoming");
  if (!t) return;

  t.innerHTML = list.map(r => `
    <tr>
      <td>${r.skillId?.title || "-"}</td>
      <td>${r.requesterId?.name || "-"}</td>
      <td>${r.message || ""}</td>
      <td>${badgeForStatus(r.status)}</td>
      <td>
        ${r.status === "pending" ? `
          <button class="btn btn-sm btn-success" onclick="setStatus('${r._id}','accepted')">Accept</button>
          <button class="btn btn-sm btn-danger" onclick="setStatus('${r._id}','rejected')">Reject</button>
        ` : ""}
        ${r.status === "accepted" ? `
          <button class="btn btn-sm btn-primary" onclick="setStatus('${r._id}','completed')">Complete</button>
        ` : ""}
      </td>
    </tr>
  `).join("");
}


async function loadOutgoing() {
  await initReviewModal();
  const auth = await ensureLogin();

  const res = await fetch(
    API(`/api/requests/outgoing?userId=${auth.user.userId}`),
    { headers: authHeaders() }
  );
  const list = await res.json();

  const t = document.getElementById("outgoing");
  if (!t) return;

  t.innerHTML = list.map(r => `
    <tr>
      <td>${r.skillId?.title || "-"}</td>
      <td>${r.ownerId?.name || "-"}</td>
      <td>${badgeForStatus(r.status)}</td>
      <td>
        ${r.status === "completed" && !r.isReviewed ? `
          <button class="btn btn-sm btn-primary" onclick="leaveReview('${r._id}')">Leave Review</button>
        ` : (r.status === "completed" ? `<span class="text-muted small">Reviewed</span>` : "")}
      </td>
    </tr>
  `).join("");
}

async function setStatus(requestId, status) {
  const auth = await ensureLogin();

  const res = await fetch(API(`/api/requests/${requestId}/status`), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ userId: auth.user.userId, status })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "Failed");

  await loadIncoming();
  await loadOutgoing();
}

let reviewModalInstance = null;

function leaveReview(requestId) {
  document.getElementById("reviewRequestId").value = requestId;
  document.getElementById("reviewRating").value = "";
  document.getElementById("reviewComment").value = "";

  const err = document.getElementById("reviewErr");
  if (err) {
    err.style.display = "none";
    err.textContent = "";
  }

  const modalEl = document.getElementById("reviewModal");
  reviewModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
  reviewModalInstance.show();
}


/* -------- expose functions -------- */
window.SkillSwap = {
  loadSkills,
  loadMySkills,
  createSkill,
  loadIncoming,
  loadOutgoing,
  renderUserNav,
  guardSellerPage,
  renderDashboardByRole
};


window.requestSkill = requestSkill;
window.deleteSkill = deleteSkill;
window.setStatus = setStatus;
window.leaveReview = leaveReview;

async function initReviewModal() {
  const form = document.getElementById("reviewForm");
  if (!form) return; // not on dashboard page

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const auth = await ensureLogin();

    const requestId = document.getElementById("reviewRequestId").value;
    const ratingRaw = document.getElementById("reviewRating").value;
    const comment = document.getElementById("reviewComment").value || "";

    const err = document.getElementById("reviewErr");
    err.style.display = "none";
    err.textContent = "";

    const rating = parseInt(ratingRaw, 10);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      err.textContent = "Please select a rating from 1 to 5.";
      err.style.display = "block";
      return;
    }

    const res = await fetch(API("/api/reviews"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        requestId,
        reviewerId: auth.user.userId,
        rating,
        comment
      })
    });

    const data = await res.json();
    if (!res.ok) {
      err.textContent = data.error || "Failed to submit review.";
      err.style.display = "block";
      return;
    }

    // close modal + refresh outgoing list
    if (reviewModalInstance) reviewModalInstance.hide();
    await loadOutgoing();
  });
}

async function renderDashboardByRole() {
  const auth = await ensureLogin();
  const role = auth.user.role;

  const incoming = document.getElementById("incomingSection");
  const outgoing = document.getElementById("outgoingSection");

  if (!incoming || !outgoing) return;

  if (role === "seller") {
    incoming.style.display = "block";
    outgoing.style.display = "none";
  } else {
    incoming.style.display = "none";
    outgoing.style.display = "block";
  }
}

