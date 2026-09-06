const nav = document.querySelector('.site-nav');
const menu = document.querySelector('.nav-links');
const menuToggle = document.querySelector('.menu-toggle');
const progress = document.querySelector('.progress-bar');
let lastScroll = 0;

menuToggle.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', open);
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});

menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menu.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}));

window.addEventListener('scroll', () => {
  const y = window.scrollY;
  nav.classList.toggle('scrolled', y > 50);
  nav.classList.toggle('hidden', y > lastScroll && y > 180);
  lastScroll = y;
  progress.style.width = `${(y / (document.documentElement.scrollHeight - innerHeight)) * 100}%`;
}, { passive: true });

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (!entry.isIntersecting) return;
  entry.target.classList.add('visible');
  const link = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
  if (link) {
    document.querySelectorAll('.nav-links a').forEach((anchor) => anchor.classList.remove('active'));
    link.classList.add('active');
  }
}), { threshold: .16 });

document.querySelectorAll('.reveal, main section[id]').forEach((section) => observer.observe(section));

document.querySelectorAll('[data-count]').forEach((element) => {
  const target = Number(element.dataset.count);
  const suffix = element.textContent.includes('+') ? '+' : '';
  let started = false;
  const countObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || started) return;
    started = true;
    let current = 0;
    const tick = () => {
      current = Math.min(target, current + Math.max(1, Math.ceil(target / 18)));
      element.textContent = `${current}${suffix}`;
      if (current < target) requestAnimationFrame(tick);
    };
    tick();
  }, { threshold: .8 });
  countObserver.observe(element);
});

const modal = document.querySelector('#game-modal');
const modalClose = document.querySelector('.modal-close');
const modalLater = document.querySelector('.modal-later');
let lastTrigger;

const closeModal = () => {
  modal.classList.remove('open');
  lastTrigger?.focus();
  document.body.style.overflow = '';
};

document.querySelectorAll('[data-game]').forEach((trigger) => trigger.addEventListener('click', (event) => {
  event.preventDefault();
  lastTrigger = trigger;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  modalClose.focus();
}));

modalClose.addEventListener('click', closeModal);
modalLater.addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal.classList.contains('open')) closeModal();
  if (event.key.toLowerCase() === 'g' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    document.querySelector('[data-game]').click();
  }
});

document.querySelectorAll('.filter').forEach((filter) => filter.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach((button) => button.classList.remove('selected'));
  filter.classList.add('selected');
  const value = filter.dataset.filter;
  document.querySelectorAll('.project-card').forEach((card) => {
    card.hidden = value !== 'all' && card.dataset.category !== value;
  });
}));

document.querySelectorAll('.contact-link').forEach((link) => link.addEventListener('contextmenu', async (event) => {
  event.preventDefault();
  const value = link.querySelector('strong').textContent.replace(' ↗', '');
  try {
    await navigator.clipboard.writeText(value);
    const toast = document.querySelector('.toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  } catch {}
}));

const canvas = document.querySelector('#hero-canvas');
const context = canvas.getContext('2d');
const particles = [];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let pointer = { x: 0, y: 0 };

function resizeCanvas() {
  const ratio = Math.min(devicePixelRatio, 1.5);
  canvas.width = innerWidth * ratio;
  canvas.height = innerHeight * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function seedCanvas() {
  particles.length = 0;
  const count = innerWidth < 700 ? 55 : 115;
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: Math.random() * 2 + .5,
      vx: (Math.random() - .5) * .22,
      vy: (Math.random() - .5) * .22
    });
  }
}

function drawCanvas() {
  context.clearRect(0, 0, innerWidth, innerHeight);
  particles.forEach((particle, index) => {
    if (!reduced) {
      particle.x += particle.vx;
      particle.y += particle.vy;
    }
    if (particle.x < 0 || particle.x > innerWidth) particle.vx *= -1;
    if (particle.y < 0 || particle.y > innerHeight) particle.vy *= -1;
    const dx = particle.x - pointer.x;
    const dy = particle.y - pointer.y;
    const distance = Math.max(80, Math.hypot(dx, dy));
    particle.x += (dx / distance) * .03;
    particle.y += (dy / distance) * .03;
    context.fillStyle = index % 5 === 0 ? 'rgba(217,182,87,.7)' : 'rgba(185,216,91,.35)';
    context.beginPath();
    context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    context.fill();
  });
  if (!reduced) requestAnimationFrame(drawCanvas);
}

addEventListener('resize', () => {
  resizeCanvas();
  seedCanvas();
});
addEventListener('pointermove', (event) => {
  pointer = { x: event.clientX, y: event.clientY };
});
resizeCanvas();
seedCanvas();
drawCanvas();
