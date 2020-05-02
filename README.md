# What is animate

Animate is a little library that enables high performance animations/transitions in JS using a slightly modified CSS syntax. "slightly modified" means that you can use the known syntax that you would use in a CSS file with a little modification that enables transitions from start to end like' "height: 0px => 100px".

The values for the style are extended by an arrow followed by the desired end value. The arrow can be a fat arrow "=>" if the values should be rounded to an integer while rendering, or a regular arrow "->" if the values can be of type float.

Animation length, easing and various callbacks, together with the style settings, can be set when calling one of the animate methods "queue" or "animate".


## Example


```HTML
<div class="animate">Click me!</div>

<script>
  const anim = new Animate({ speed: 1 });
  const elm = document.querySelector('.animate');

  elm.addEventListener('click', e => anim.animate(elm,
    'position: absolute;' +
    'left: 0px => 100px;' +
    'top: 0px => 200px;' +
    'opacity: .3 -> 1;' +
    'transform: rotate(0deg => 360deg)'
  ));
</script>
```

