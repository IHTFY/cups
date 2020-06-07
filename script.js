const playArea = document.getElementById('playArea');

function flip(cup) {
  if (cup.classList.contains('up')) {
    cup.classList.replace('up', 'down');
  } else {
    cup.classList.replace('down', 'up');
  }
}

function generateCup(id, state = 'up') {
  const el = document.createElement('div');
  el.classList.add('invisible', 'cup-holder');
  el.innerHTML = `<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  version="1.1"
  class="${state}"
  id="${id}"
  x="0px"
  y="0px"
  width="100px"
  height="100px"
  viewBox="0 0 512 512"
  xml:space="preserve"
  >
  <path
    style="fill: #ff6465;"
    d="M48.886,33.212l68.345,447.384c2.76,18.063,18.294,31.406,36.568,31.406h204.406  c18.273,0,33.808-13.342,36.568-31.406l68.345-447.384H48.886z"
    />
    <polygon
    style="opacity: 0.1; fill: #171d26; enable-background: new;"
    points="58.334,95.065 453.668,95.065 463.117,33.21   48.886,33.21 "
  />
  <path
  style="fill: #f2e9dc;"
  d="M469.459,0H42.543C24.201,0,9.333,14.868,9.333,33.212s14.868,33.21,33.21,33.21h426.915  c18.342,0,33.21-14.868,33.21-33.21S487.801,0,469.459,0z"
  />
  <g>
  <path
  style="fill: #d2555a;"
  d="M411.402,123.17H100.601c-5.16,0-9.34-4.181-9.34-9.34c0-5.16,4.181-9.34,9.34-9.34H411.4   c5.16,0,9.34,4.181,9.34,9.34C420.741,118.989,416.56,123.17,411.402,123.17z"
  />
  <path
  style="fill: #d2555a;"
  d="M387.177,164.784H124.825c-5.16,0-9.34-4.181-9.34-9.34c0-5.16,4.181-9.34,9.34-9.34h262.352   c5.16,0,9.34,4.181,9.34,9.34C396.517,160.603,392.336,164.784,387.177,164.784z"
    />
    <path
    style="fill: #d2555a;"
    d="M360.449,427.3H151.555c-5.16,0-9.34-4.181-9.34-9.34c0-5.16,4.181-9.34,9.34-9.34h208.893   c5.16,0,9.34,4.181,9.34,9.34C369.789,423.119,365.607,427.3,360.449,427.3z"
    />
    <path
    style="fill: #d2555a;"
      d="M344.165,468.913H167.836c-5.16,0-9.34-4.181-9.34-9.34s4.181-9.34,9.34-9.34h176.329   c5.16,0,9.34,4.181,9.34,9.34S349.325,468.913,344.165,468.913z"
      />
      </g>
      
      <path
      class="shadow"
      style="opacity: 0.2; fill: #171d26; enable-background: new;"
      d="M191.953,480.596L128.682,66.422h-11.416  c-18.342,0-33.21-14.868-33.21-33.21C84.055,14.868,98.923,0,117.265,0H42.543C24.201,0,9.333,14.868,9.333,33.21  s14.868,33.21,33.21,33.21h11.416l63.272,414.174c2.76,18.063,18.294,31.406,36.568,31.406h74.722  C210.247,512,194.712,498.658,191.953,480.596z"
      />
      </svg>`
  playArea.appendChild(el);
  el.addEventListener('click', () => flip(el.childNodes[0]));
  return el;
}

const cupSlider = document.getElementById('cupSlider');
let cups = Array(+cupSlider.max).fill('up').map((d, i) => generateCup(`cup${i}`, d));

const cupSliderLabel = document.getElementById('cupSliderLabel');
function showUpTo(n) {
  cupSliderLabel.textContent = `Number of Cups: ${cupSlider.value}`;
  for (let i = 0; i < n; i++) {
    cups[i].classList.remove('invisible');
    cups[i].classList.add('visible');
  }
  // const n_0 = playArea.childElementCount;
  for (let i = n; i < cups.length; i++) {
    cups[i].classList.remove('visible');
    cups[i].classList.add('invisible');
  }
}

showUpTo(cupSlider.value);
cupSlider.addEventListener('input', () => {
  showUpTo(cupSlider.value);
})

const resetButton = document.getElementById('resetButton');
resetButton.addEventListener('click', () => {
  cups.forEach(el => {
    el = el.childNodes[0];
    el.classList.remove('down');
    el.classList.add('up');
  })
})

const randomButton = document.getElementById('randomButton');
randomButton.addEventListener('click', () => {
  for (let i = 0; i < cups.length; i++) {
    const cup = cups[i].childNodes[0];
    if (Math.random() < 0.5) {
      cup.classList.remove('down');
      cup.classList.add('up');
    } else {
      cup.classList.remove('up');
      cup.classList.add('down');
    }
  }
})

