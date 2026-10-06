(() => {
  "use strict";

  const API = "/lab/api";
  const SAVE_FAILED = "저장하지 못했어요. 다시 시도해 주세요";
  const SCALE = {
    resemblance: {
      question: "이 그림이 사진 속 사람과 닮았나요?",
      legend: "닮음 점수",
      labels: ["전혀 다른 사람", "닮지 않았다", "애매하다", "닮았다", "누가 봐도 같은 사람"],
    },
    consistency: {
      question: "다섯 장면이 같은 캐릭터로 보이나요?",
      legend: "일관성 점수",
      labels: ["장면마다 다른 사람", "여러 장면이 다르다", "한 장면이 다른 사람 같다", "사소한 차이", "모든 장면이 같은 캐릭터"],
    },
  };

  const $ = (id) => document.getElementById(id);
  const screens = { name: $("screen-name"), task: $("screen-task"), done: $("screen-done") };
  const el = {
    progressBox: $("progress-box"),
    reviewerName: $("reviewer-name"),
    doneCount: $("done-count"),
    totalCount: $("total-count"),
    progressBar: $("progress-bar"),
    card: $("task-card"),
    taskNo: $("task-no"),
    question: $("question"),
    pictures: $("pictures"),
    scoreLegend: $("score-legend"),
    scoreTexts: [...document.querySelectorAll(".score-text")],
    scoreInputs: [...document.querySelectorAll('input[name="score"]')],
    pictureExtra: $("picture-extra"),
    usable: $("usable"),
    tagInputs: [...document.querySelectorAll('input[name="tags"]')],
    alert: $("alert"),
    alertText: $("alert-text"),
    next: $("next"),
    doneText: $("done-text"),
    loadError: $("load-error"),
    loadErrorText: $("load-error-text"),
  };

  const reviewer = (new URLSearchParams(location.search).get("reviewer") || "").trim();
  const state = { tasks: [], done: 0, saving: false, usableTouched: false };

  function show(name) {
    for (const [key, section] of Object.entries(screens)) section.hidden = key !== name;
  }

  async function getJson(path) {
    const r = await fetch(path, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    return r.json();
  }

  function figure(src, alt, caption) {
    const fig = document.createElement("figure");
    const frame = document.createElement("div");
    frame.className = "frame";
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.decoding = "async";
    frame.append(img);
    const cap = document.createElement("figcaption");
    cap.textContent = caption;
    fig.append(frame, cap);
    return fig;
  }

  function currentTask() {
    return state.tasks[state.done];
  }

  function isPicture(task) {
    return task.type === "resemblance";
  }

  function selectedScore() {
    const checked = el.scoreInputs.find((input) => input.checked);
    return checked ? Number(checked.value) : 0;
  }

  function renderProgress() {
    el.reviewerName.textContent = reviewer;
    el.doneCount.textContent = String(state.done);
    el.totalCount.textContent = String(state.tasks.length);
    el.progressBar.max = Math.max(state.tasks.length, 1);
    el.progressBar.value = state.done;
    el.progressBox.hidden = false;
  }

  function renderTask() {
    const task = currentTask();
    const scale = SCALE[task.type];
    const picture = isPicture(task);

    el.taskNo.textContent = `과제 ${state.done + 1} / ${state.tasks.length}`;
    el.question.textContent = scale.question;
    el.scoreLegend.textContent = scale.legend;
    el.scoreTexts.forEach((span, i) => {
      span.textContent = scale.labels[i];
    });

    el.pictures.replaceChildren();
    el.pictures.className = picture ? "pictures pair" : "pictures reel";
    if (picture) {
      el.pictures.removeAttribute("tabindex");
      el.pictures.removeAttribute("role");
      el.pictures.removeAttribute("aria-label");
      el.pictures.append(
        figure(task.photoUrl, "원본 사진", "원본 사진"),
        figure(task.imageUrls[0], `그림: ${task.captions[0]}`, task.captions[0]),
      );
    } else {
      el.pictures.tabIndex = 0;
      el.pictures.setAttribute("role", "group");
      el.pictures.setAttribute("aria-label", "장면 그림 다섯 장, 옆으로 넘길 수 있어요");
      task.imageUrls.forEach((url, i) => {
        el.pictures.append(figure(url, `그림 ${i + 1}: ${task.captions[i]}`, task.captions[i]));
      });
    }

    el.card.classList.toggle("resemblance", picture);
    el.pictureExtra.hidden = !picture;
    el.scoreInputs.forEach((input) => {
      input.checked = false;
    });
    el.tagInputs.forEach((input) => {
      input.checked = false;
    });
    el.usable.checked = false;
    state.usableTouched = false;
    el.alert.hidden = true;
    el.next.disabled = true;

    el.card.classList.remove("enter");
    void el.card.offsetWidth;
    el.card.classList.add("enter");
    el.question.focus();
  }

  function render() {
    renderProgress();
    if (state.done >= state.tasks.length) {
      el.doneText.textContent = `${reviewer} 님, 과제 ${state.tasks.length}개를 모두 검토했어요. 고마워요.`;
      show("done");
      return;
    }
    renderTask();
    show("task");
  }

  function onScoreChange() {
    const score = selectedScore();
    if (!state.usableTouched) el.usable.checked = score >= 4;
    el.next.disabled = score === 0;
  }

  function setScore(n) {
    const input = el.scoreInputs.find((candidate) => Number(candidate.value) === n);
    if (!input) return;
    input.checked = true;
    onScoreChange();
  }

  async function save() {
    const task = currentTask();
    const score = selectedScore();
    if (state.saving || !task || !score) return;
    state.saving = true;
    el.next.disabled = true;
    el.alert.hidden = true;

    const picture = isPicture(task);
    const body = {
      reviewer,
      taskId: task.taskId,
      score,
      usable: picture ? el.usable.checked : null,
      tags: picture ? el.tagInputs.filter((input) => input.checked).map((input) => input.value) : [],
    };
    let ok = false;
    try {
      const r = await fetch(`${API}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      ok = r.ok;
    } catch {
      ok = false;
    }
    state.saving = false;
    if (!ok) {
      el.alertText.textContent = SAVE_FAILED;
      el.alert.hidden = false;
      el.next.disabled = false;
      return;
    }
    state.done += 1;
    render();
  }

  el.scoreInputs.forEach((input) => input.addEventListener("change", onScoreChange));
  el.usable.addEventListener("change", () => {
    state.usableTouched = true;
  });
  el.next.addEventListener("click", save);
  document.addEventListener("keydown", (e) => {
    if (screens.task.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target;
    if (target instanceof HTMLInputElement && target.type === "text") return;
    if (e.key.length === 1 && e.key >= "1" && e.key <= "5") {
      e.preventDefault();
      setScore(Number(e.key));
      return;
    }
    if (e.key === "Enter") {
      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
      e.preventDefault();
      save();
    }
  });

  function showLoadError(text) {
    el.loadErrorText.textContent = text;
    el.loadError.hidden = false;
  }

  async function boot() {
    if (!reviewer) {
      show("name");
      $("reviewer").focus();
      return;
    }
    const query = `?reviewer=${encodeURIComponent(reviewer)}`;
    try {
      const tasks = await getJson(`${API}/tasks${query}`);
      const progress = await getJson(`${API}/progress${query}`);
      state.tasks = tasks;
      state.done = Math.min(progress.done, tasks.length);
    } catch {
      showLoadError("과제를 불러오지 못했어요. 새로 고쳐 주세요");
      return;
    }
    if (state.tasks.length === 0) {
      showLoadError("검토할 그림이 아직 없어요");
      return;
    }
    render();
  }

  boot();
})();
