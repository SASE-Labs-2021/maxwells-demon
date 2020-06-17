// module aliases
var Engine = Matter.Engine,
    Render = Matter.Render,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body
    Vector = Matter.Vector,
    Composites = Matter.Composites,
    Events = Matter.Events,
    Common = Matter.Common;

// possible fix to implement elastic collisions
Matter.Resolver._restingThresh = 0.001;

// reproducability
// 8
Common._seed = 8;

// create an engine
var engine = Engine.create(),
    world = engine.world;
engine.world.gravity.y = 0;

// create a renderer
var render = Render.create({
    element: document.getElementById('demon'),
    engine: engine,
    options: {
        wireframes: false
    }
});

// define perfectly elastic collisions
const elasticSettings = {
    mass: 0,
    inertia: Infinity,
    inverseInertia: 0,
    friction: 0,
    frictionStatic: 1,
    frictionAir: 0,
    restitution: 1
}

const redWallSettings = {
    ...elasticSettings,
    isStatic: true,
    render: {
        fillStyle: 'red'
    }
}

const blueWallSettings = {
    ...elasticSettings,
    isStatic: true,
    render: {
        fillStyle: 'blue'
    }
}

const purpleWallSettings = {
    ...elasticSettings,
    isStatic: true,
    render: {
        fillStyle: 'purple'
    }
}

// add walls
World.add(world, [
    Bodies.rectangle(200, 0, 400, 50, { ...redWallSettings, label: 'wall' }),
    Bodies.rectangle(200, 600, 400, 50, { ...redWallSettings, label: 'wall' }),
    Bodies.rectangle(600, 0, 400, 50, { ...blueWallSettings, label: 'wall' }),
    Bodies.rectangle(600, 600, 400, 50, { ...blueWallSettings, label: 'wall' }),
    Bodies.rectangle(800, 300, 50, 600, { ...blueWallSettings, label: 'wall' }),
    Bodies.rectangle(0, 300, 50, 600, { ...redWallSettings, label: 'wall' }),
    Bodies.rectangle(400, 100, 25, 200, { ...purpleWallSettings, label: 'wall' }),
    Bodies.rectangle(400, 500, 25, 200, { ...purpleWallSettings, label: 'wall' }),
    Bodies.rectangle(400, 300, 25, 200, { 
        ...elasticSettings,
        isStatic: true,
        render: {
            fillStyle: 'purple'
        },
        label: 'door'
    }),
    Bodies.circle(400, 500, 40, {
        ...elasticSettings,
        isStatic: true,
        isSensor: true,
        render: {
            sprite: {
                texture: 'devil.png',
                xScale: 0.15,
                yScale: 0.15
            }
        }
    })
]);

const GAS_SPEED = 1;

// utility for creating a gas particle
// the speed distribution starts uniform, but relaxes into a
// Maxwell-Boltzmann distribution because statistics
const green = '#008000' 
function createGas(x, y) {
    var gas = Bodies.circle(x, y, 10, { 
        ...elasticSettings,
        render: { 
            fillStyle: green
        },
        label: 'gas'
    });
    var velocity = Vector.rotate(Vector.create(GAS_SPEED, 0), Common.random(0, 2*Math.PI));
    Body.setVelocity(gas, velocity);
    return gas;
}

// sensor for the door
var sensor = Bodies.rectangle(400, 300, 40, 200, {
    isSensor: true,
    isStatic: true,
    render: {
        fillStyle: 'transparent',
        lineWidth: 0
    }
});

var erasures = 0;

// utility to change color of particle based on its speed
function shadeColor(color, percent) {
    var R = parseInt(color.substring(1,3), 16);
    var G = parseInt(color.substring(3,5), 16);
    var B = parseInt(color.substring(5,7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R<255) ? R:255;  
    G = (G<255) ? G:255;  
    B = (B<255) ? B:255;  

    var RR = ((R.toString(16).length==1) ? "0"+R.toString(16) : R.toString(16));
    var GG = ((G.toString(16).length==1) ? "0"+G.toString(16) : G.toString(16));
    var BB = ((B.toString(16).length==1) ? "0"+B.toString(16) : B.toString(16));

    return "#"+RR+GG+BB;
}

// populate with gas
var stack_left = Composites.stack(100, 100, 3, 4, 100, 100, createGas);
var stack_right = Composites.stack(500, 100, 3, 4, 100, 100, createGas);
World.add(world, [stack_left, stack_right, sensor]);

// histograms of the Maxwell-Boltzmann distributions
var left_data = stack_left.bodies.map(body => body.speed);
var right_data = stack_right.bodies.map(body => body.speed);
Plotly.newPlot('left_plot', [{ x: left_data, type: 'histogram'}]);
Plotly.newPlot('right_plot', [{ x: right_data, type: 'histogram'}]);

// enforce elastic collisions
// by looking at the velocity before the collision
// and setting that to be the final velocity after
var prevSpeeds = {};
var ids = (stack_left.bodies.map(body => body.id)).concat(stack_right.bodies.map(body => body.id));
var speeds = (stack_left.bodies.map(body => body.velocity)).concat(stack_right.bodies.map(body => body.velocity));
ids.forEach((id, i) => prevSpeeds[id] = speeds[i]);
Events.on(engine, 'collisionStart', function(event) {
    var pairs = event.pairs;
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        if (pair.bodyA.label === 'gas') {
            prevSpeeds[pair.bodyA.id] = pair.bodyA.speed;
        }
        if (pair.bodyB.label == 'gas') {
            prevSpeeds[pair.bodyB.id] = pair.bodyB.speed;
        }
    }
});
// the demon also has to keep track of all 
// the speeds of the particles in their 
// brain
Events.on(engine, 'collisionEnd', function(event) {
    var pairs = event.pairs;
    var brain = document.getElementById('brain');
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        if (pair.bodyA.label === 'gas' && (pair.bodyB.label === 'wall' || pair.bodyB.label === 'door')) {
            let speedMultiplier = prevSpeeds[bodyA.id]/pair.bodyA.speed;
            var velocity = { 
                x: pair.bodyA.velocity.x*speedMultiplier, 
                y: pair.bodyA.velocity.y*speedMultiplier
            };
            Body.setVelocity(pair.bodyA, velocity);
            var mem = document.createElement('li');
            mem.appendChild(document.createTextNode(JSON.stringify(velocity)));
            brain.appendChild(mem);
        }
        if (pair.bodyB.label === 'gas' && (pair.bodyA.label === 'wall' || pair.bodyA.label === 'door')) {
            let speedMultiplier = prevSpeeds[pair.bodyB.id]/pair.bodyB.speed;
            var velocity = { 
                x: pair.bodyB.velocity.x*speedMultiplier, 
                y: pair.bodyB.velocity.y*speedMultiplier
            };
            Body.setVelocity(pair.bodyB, velocity);
            var mem = document.createElement('li');
            mem.appendChild(document.createTextNode(JSON.stringify(velocity)));
            brain.appendChild(mem);
        }
    }
    left_data = stack_left.bodies.map(body => body.speed);
    right_data = stack_right.bodies.map(body => body.speed);
    Plotly.react('left_plot', [{ x: left_data, type: 'histogram' }]);
    Plotly.react('right_plot', [{ x: right_data, type: 'histogram' }]);
});

// AI for demon
Events.on(engine, 'collisionActive', function(event) {
    var pairs = event.pairs;
    var decision = 0;
    const average = list => list.reduce((prev, curr) => prev + curr)/list.length;
    var speed_avg = average(stack_left.bodies.map(body => body.speed).concat(stack_right.bodies.map(body => body.speed)));
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        if (pair.bodyA.label === 'gas') {
            pair.bodyA.render.fillStyle = shadeColor(green, 100*(pair.bodyA.speed-GAS_SPEED)/GAS_SPEED);
        }
        if (pair.bodyB.label === 'gas') {
            pair.bodyB.render.fillStyle = shadeColor(green, 100*(pair.bodyB.speed-GAS_SPEED)/GAS_SPEED);
        }
        if (pair.bodyA === sensor) {
            if (pair.bodyB.speed > speed_avg && pair.bodyB.velocity.x < 0) {
                decision++;
            }
            else if (pair.bodyB.speed < speed_avg && pair.bodyB.velocity.x > 0) {
                decision++;
            }
            else {
                decision--;
            }
        }
        if (pair.bodyB === sensor) {
            if (pair.bodyA.speed > speed_avg && pair.bodyA.velocity.x < 0) {
                decision++;
            }
            else if (pair.bodyA.speed > speed_avg && pair.bodyA.velocity.x > 0) {
                decision++;
            }
            else {
                decision--;
            }
        }
    }
    let door = world.bodies.find(obj => obj.label === 'door');
    if (decision <= 0) {
        door.render.fillStyle = 'purple';
        door.isSensor = false;
    }
    else {
        door.render.fillStyle = 'transparent';
        door.isSensor = true;
    }
    if (brain.childElementCount >= 15) {
        brain.textContent = '';
        erasures++;
        document.getElementById('erasures').innerHTML = erasures;
    }
});

// run the engine
Engine.run(engine);

// run the renderer
Render.run(render);
