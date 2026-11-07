import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..", "demo-output");
const media = path.resolve(here, "..", "..", "docs", "media");
const images = path.resolve(here, "..", "..", "docs", "images");
const work = path.join(out, "compose");
mkdirSync(work, { recursive: true });
mkdirSync(media, { recursive: true });

const FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf";
const FPS = 30;
const CANVAS = { w: 3840, h: 2160 };
const HOST = { w: 1944, h: 1400, r: 40 };
const PHONE = { w: 700, h: 1400, r: 96 };
const GAP = 160;
const TOP = 330;
const LEFT = Math.round((CANVAS.w - (HOST.w + GAP + PHONE.w)) / 2);
const hostPos = { x: LEFT, y: TOP };
const phonePos = { x: LEFT + HOST.w + GAP, y: TOP };
const hostCenter = { x: hostPos.x + HOST.w / 2, y: hostPos.y + HOST.h / 2 };
const phoneCenter = { x: phonePos.x + PHONE.w / 2, y: phonePos.y + PHONE.h / 2 };
const stageCenter = { x: CANVAS.w / 2, y: 1060 };

const ffmpeg = (args) =>
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
  });

const { marks } = JSON.parse(readFileSync(path.join(out, "marks.json"), "utf8"));
const start = marks.start;
const rel = (name) => marks[name] - start;
const mainDuration = rel("end") + 1.6;
const cardDuration = 3.2;
const fadeDuration = 0.8;

function buildVideo(name) {
  const dir = path.join(out, name);
  const frames = JSON.parse(readFileSync(path.join(dir, "frames.json"), "utf8"));
  let first = 0;
  frames.forEach((frame, index) => {
    if (frame.at <= start) first = index;
  });
  const usable = frames.slice(first);
  const endAt = start + mainDuration;
  const lines = [];
  usable.forEach((frame, index) => {
    const from = index === 0 ? start : frame.at;
    const to = index + 1 < usable.length ? usable[index + 1].at : endAt;
    const duration = Math.max(to - from, 0.001);
    lines.push(`file '${path.join(dir, frame.file)}'`, `duration ${duration.toFixed(4)}`);
  });
  lines.push(`file '${path.join(dir, usable[usable.length - 1].file)}'`);
  const list = path.join(work, `${name}.txt`);
  writeFileSync(list, lines.join("\n"));
  const target = path.join(work, `${name}.mp4`);
  ffmpeg([
    "-f", "concat", "-safe", "0", "-i", list,
    "-vf", `fps=${FPS},format=yuv420p`,
    "-c:v", "libx264", "-crf", "12", "-preset", "veryfast", "-an", target,
  ]);
  return target;
}

function buildMask(name, { w, h, r }) {
  const r2 = r * 2;
  const target = path.join(work, `mask-${name}.png`);
  ffmpeg([
    "-f", "lavfi", "-i", `color=c=white:s=${w * 2}x${h * 2}`,
    "-vf",
    `format=gray,geq=lum='if(gt(hypot(max(abs(X-W/2)-(W/2-${r2}),0),max(abs(Y-H/2)-(H/2-${r2}),0)),${r2}),0,255)',scale=${w}:${h}:flags=area`,
    "-frames:v", "1", target,
  ]);
  const margin = 160;
  const blurred = path.join(work, `blur-${name}.png`);
  ffmpeg([
    "-i", target,
    "-vf", `pad=${w + margin * 2}:${h + margin * 2}:${margin}:${margin}:color=black,boxblur=48:3,lutyuv=y=val*0.6`,
    "-frames:v", "1", blurred,
  ]);
  const shadow = path.join(work, `shadow-${name}.png`);
  ffmpeg([
    "-f", "lavfi", "-i", `color=c=black:s=${w + margin * 2}x${h + margin * 2}`,
    "-i", blurred,
    "-filter_complex", "[0:v][1:v]alphamerge",
    "-frames:v", "1", shadow,
  ]);
  return { mask: target, shadow };
}

const smooth = (startAt, duration) => {
  const p = `clip((on/${FPS}-${startAt.toFixed(3)})/${duration.toFixed(3)},0,1)`;
  return `(${p}*${p}*(3-2*${p}))`;
};

function cameraPlan() {
  const m = rel;
  const steps = [];
  const to = (at, duration, zoom, point) =>
    steps.push({ at, duration, zoom, x: point.x, y: point.y });

  to(m("phone_join") - 0.2, 1.0, 1.9, { x: phoneCenter.x, y: phoneCenter.y - 60 });
  to(m("vote_done") + 0.5, 0.9, 1.0, stageCenter);
  to(m("vote_done") + 1.5, 0.9, 1.5, { x: hostCenter.x, y: hostPos.y + HOST.h * 0.36 });
  to(m("exit_presenter") - 0.2, 0.9, 1.0, stageCenter);
  to(m("question_start") - 0.2, 1.0, 2.0, { x: phoneCenter.x, y: phoneCenter.y });
  to(m("question_sent") + 0.6, 0.9, 1.0, stageCenter);
  to(m("question_sent") + 1.6, 0.9, 1.25, { x: hostCenter.x, y: hostCenter.y + 130 });
  to(m("answer_click") + 1.4, 0.9, 1.0, stageCenter);
  to(m("analytics_ready") - 0.3, 1.0, 1.25, { x: hostCenter.x, y: hostCenter.y + 130 });
  to(m("end") + 0.2, 1.0, 1.0, stageCenter);

  let previous = { zoom: 1, x: stageCenter.x, y: stageCenter.y };
  const zoomTerms = [];
  const xTerms = [];
  const yTerms = [];
  for (const step of steps) {
    const s = smooth(step.at, step.duration);
    zoomTerms.push(`(${(step.zoom - previous.zoom).toFixed(4)})*${s}`);
    xTerms.push(`(${(step.x - previous.x).toFixed(2)})*${s}`);
    yTerms.push(`(${(step.y - previous.y).toFixed(2)})*${s}`);
    previous = step;
  }
  const zoom = `(1+${zoomTerms.join("+")})`;
  const cx = `(${stageCenter.x}+${xTerms.join("+")})`;
  const cy = `(${stageCenter.y}+${yTerms.join("+")})`;
  return {
    z: zoom,
    x: `max(0,min(iw-iw/${zoom},${cx}-iw/${zoom}/2))`,
    y: `max(0,min(ih-ih/${zoom},${cy}-ih/${zoom}/2))`,
  };
}

const captions = [
  ["room_ready", "present_open", "Open a demo room in one click"],
  ["present_open", "phone_join", "Present live results on the big screen"],
  ["phone_join", "vote_start", "Participants join from a phone with just a name"],
  ["vote_start", "exit_presenter", "Votes land on screen in real time"],
  ["question_start", "question_sent", "Ask questions, anonymously if you like"],
  ["question_visible", "answer_click", "They show up for the host instantly"],
  ["answer_click", "dark_toggle", "Mark questions as answered"],
  ["dark_toggle", "analytics_ready", "Light and dark themes"],
  ["analytics_ready", "end", "Privacy-friendly analytics, no cookies"],
];

function captionFilters() {
  const windows = captions.map(([a, b]) => `between(t,${rel(a).toFixed(2)},${(rel(b) - 0.1).toFixed(2)})`);
  const strip = `drawbox=x=0:y=ih-170:w=iw:h=170:color=black@0.45:t=fill:enable='${windows.join("+")}'`;
  const texts = captions.map(([a, b, text]) => {
    const s = rel(a).toFixed(2);
    const e = (rel(b) - 0.1).toFixed(2);
    const alpha = `if(lt(t,${s}),0,if(lt(t,${s}+0.35),(t-${s})/0.35,if(lt(t,${e}-0.35),1,if(lt(t,${e}),(${e}-t)/0.35,0))))`;
    return `drawtext=fontfile='${FONT}':text='${text}':fontsize=50:fontcolor=white:x=(w-text_w)/2:y=h-108:alpha='${alpha}':shadowcolor=black@0.6:shadowx=2:shadowy=2`;
  });
  const title = (text, size, y, color, from, to) => {
    const alpha = `if(lt(t,${from}),0,if(lt(t,${from}+0.5),(t-${from})/0.5,if(lt(t,${to}-0.5),1,if(lt(t,${to}),(${to}-t)/0.5,0))))`;
    return `drawtext=fontfile='${FONT}':text='${text}':fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}:alpha='${alpha}'`;
  };
  return [
    strip,
    ...texts,
    title("Crowd Pulse", 68, 38, "white", 0.3, 3.3),
    title("Live polls and Q&A with privacy-friendly analytics", 30, 118, "0x99f6e4", 0.5, 3.3),
  ].join(",");
}

function endCardFilters() {
  const line = (text, size, y, color) =>
    `drawtext=fontfile='${FONT}':text='${text}':fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}`;
  return [
    line("Crowd Pulse", 120, 330, "white"),
    line("Live polls and Q&A, with its own analytics", 44, 500, "0x99f6e4"),
    line("Fastify  Postgres  Redis  Socket.IO  Module Federation", 34, 575, "0xcbd5e1"),
    line("crowd-pulse-shell.vercel.app", 58, 720, "white"),
    line("github.com/ebubekirylmaz/crowd-pulse", 38, 810, "0x94a3b8"),
  ].join(",");
}

const hostVideo = buildVideo("host");
const phoneVideo = buildVideo("phone");
const hostArt = buildMask("host", HOST);
const phoneArt = buildMask("phone", PHONE);

const background = path.join(work, "bg.png");
ffmpeg([
  "-f", "lavfi",
  "-i", `gradients=size=${CANVAS.w}x${CANVAS.h}:c0=0x0b1220:c1=0x134e4a:x0=0:y0=0:x1=${CANVAS.w}:y1=${CANVAS.h}:nb_colors=2:rate=1:duration=1`,
  "-frames:v", "1", background,
]);

const camera = cameraPlan();
const graph = [
  `[1:v]scale=${HOST.w}:${HOST.h}:flags=lanczos,format=yuva420p[hv]`,
  `[3:v]format=gray[hm]`,
  `[hv][hm]alphamerge[hw]`,
  `[2:v]scale=${PHONE.w}:${PHONE.h}:flags=lanczos,format=yuva420p[pv]`,
  `[4:v]format=gray[pm]`,
  `[pv][pm]alphamerge[pw]`,
  `[0:v][5:v]overlay=${hostPos.x - 160}:${hostPos.y - 160 + 40}:format=auto[b1]`,
  `[b1][6:v]overlay=${phonePos.x - 160}:${phonePos.y - 160 + 40}:format=auto[b2]`,
  `[b2][hw]overlay=${hostPos.x}:${hostPos.y}:format=auto[b3]`,
  `[b3][pw]overlay=${phonePos.x}:${phonePos.y}:format=auto[b4]`,
  `[b4]zoompan=z='${camera.z}':x='${camera.x}':y='${camera.y}':d=1:s=1920x1080:fps=${FPS},${captionFilters()},format=yuv420p[main]`,
  `[7:v]scale=1920:1080,${endCardFilters()},format=yuv420p,fps=${FPS}[card]`,
  `[main][card]xfade=transition=fade:duration=${fadeDuration}:offset=${(mainDuration - fadeDuration).toFixed(3)}[final]`,
].join(";\n");
const script = path.join(work, "graph.txt");
writeFileSync(script, graph);

const total = mainDuration + cardDuration - fadeDuration;
const target = path.join(media, "demo.mp4");
const loop = (file) => ["-loop", "1", "-framerate", String(FPS), "-t", String(mainDuration), "-i", file];
ffmpeg([
  ...loop(background),
  "-i", hostVideo,
  "-i", phoneVideo,
  ...loop(hostArt.mask),
  ...loop(phoneArt.mask),
  ...loop(hostArt.shadow),
  ...loop(phoneArt.shadow),
  "-loop", "1", "-framerate", String(FPS), "-t", String(cardDuration), "-i", background,
  "-filter_complex_script", script,
  "-map", "[final]", "-t", total.toFixed(3),
  "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-movflags", "+faststart", "-an", target,
]);

ffmpeg([
  "-i", target,
  "-vf",
  "fps=9,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
  "-loop", "0", path.join(images, "demo.gif"),
]);

console.log(`wrote ${target} (${total.toFixed(1)} s) and demo.gif`);
