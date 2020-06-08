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
    element: document.body,
    engine: engine,
    options: {
        wireframes: false
    }
});

// define collsion filtering categories
var defaultCategory = 0x0001,
    ballCategory = 0x0002;

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
    Bodies.rectangle(200, 0, 400, 50, { ...redWallSettings }),
    Bodies.rectangle(200, 600, 400, 50, { ...redWallSettings }),
    Bodies.rectangle(600, 0, 400, 50, { ...blueWallSettings }),
    Bodies.rectangle(600, 600, 400, 50, { ...blueWallSettings }),
    Bodies.rectangle(800, 300, 50, 600, { ...blueWallSettings }),
    Bodies.rectangle(0, 300, 50, 600, { ...redWallSettings }),
    Bodies.rectangle(400, 100, 25, 200, { ...purpleWallSettings }),
    Bodies.rectangle(400, 500, 25, 200, { ...purpleWallSettings }),
    Bodies.rectangle(400, 300, 25, 200, { 
        ...elasticSettings,
        isStatic: true,
        render: {
            fillStyle: 'purple'
        },
        collisionFilter: {
            category: defaultCategory
        },
        label: 'door'
    }),
    Bodies.circle(400, 500, 40, {
        ...elasticSettings,
        isStatic: true,
        collisionFilter: {
            category: ballCategory
        },
        render: {
            sprite: {
                texture: 'devil.png',
                xScale: 0.15,
                yScale: 0.15
            }
        }
    })
]);

const HOT_SPEED = 8;
const COLD_SPEED = 4;

// utility for creating a gas particle
// TODO: switch to Maxwell-Boltzmann distribution?
function createGas(x, y) {
    switch (Math.round(Common.random(0, 1))) {
        case 0: // hot gas
            var hottie = Bodies.circle(x, y, 10, { 
                ...elasticSettings,
                collisionFilter: {
                    category: ballCategory,
                    mask: defaultCategory
                },
                render: { 
                    fillStyle: 'darkred' 
                }
            });
            var velocity = Vector.rotate(Vector.create(HOT_SPEED, 0), Common.random(0, 360));
            Body.setVelocity(hottie, velocity);
            return hottie;
        case 1: // cold gas
            var coldie = Bodies.circle(x, y, 10, { 
                ...elasticSettings,
                collisionFilter: {
                    category: ballCategory,
                    mask: defaultCategory
                },
                render: { 
                    fillStyle: 'cyan' 
                }
            });
            var velocity = Vector.rotate(Vector.create(COLD_SPEED, 0), Common.random(0, 360));
            Body.setVelocity(coldie, velocity);
            return coldie;
    }
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

// AI for demon
Events.on(engine, 'collisionActive', function(event) {
    var pairs = event.pairs;

    var decision = 0;
    var brain = document.getElementById('brain')
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        if (pair.bodyA === sensor) {
            var temp = pair.bodyB.render.fillStyle == 'darkred' ? 'hot' : 'cold';
            var dir  = pair.bodyB.velocity.x < 0 ? 'left' : 'right';
            var mem  = document.createElement('li');
            mem.appendChild(document.createTextNode([temp, dir].join(', ')));
            brain.appendChild(mem);
            if (pair.bodyB.render.fillStyle === 'darkred' && pair.bodyB.velocity.x < 0) {
                decision++;
            }
            else if (pair.bodyB.render.fillStyle === 'cyan' && pair.bodyB.velocity.x > 0) {
                decision++;
            }
            else {
                decision--;
            }
        }
        if (pair.bodyB === sensor) {
            var temp = pair.bodyA.render.fillStyle == 'darkred' ? 'hot' : 'cold';
            var dir  = pair.bodyA.velocity.x < 0 ? 'left' : 'right';
            var mem  = document.createElement('li');
            mem.appendChild(document.createTextNode([temp, dir].join(', ')));
            brain.appendChild(mem);
            if (pair.bodyA.render.fillStyle === 'darkred' && pair.bodyA.velocity.x < 0) {
                decision++;
            }
            else if (pair.bodyA.render.fillStyle === 'cyan' && pair.bodyA.velocity.x > 0) {
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
        door.collisionFilter.category = defaultCategory;
    }
    else {
        door.render.fillStyle = 'transparent';
        door.collisionFilter.category = ballCategory;
    }
    if (brain.childElementCount >= 15) {
        brain.textContent = '';
        erasures++;
        document.getElementById('erasures').innerHTML = erasures;
    }
});

// enforce elastic collisions
Events.on(engine, 'afterCollision', function(event) {
    var pairs = event.pairs;

    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        if (pair.bodyA.render.fillStyle === 'darkred') { // hot gas
            let speedMultiplier = HOT_SPEED/pair.bodyA.speed;
            Body.setVelocity(pair.bodyA, { 
                x: pair.bodyA.velocity.x*speedMultiplier, 
                y: pair.bodyA.velocity.y*speedMultiplier
            });
        }
        if (pair.bodyB.render.fillStyle === 'cyan') { // cold gas
            let speedMultiplier = COLD_SPEED/pair.bodyB.speed;
            Body.setVelocity(pair.bodyB, { 
                x: pair.bodyB.velocity.x*speedMultiplier, 
                y: pair.bodyB.velocity.y*speedMultiplier
            });
        }
        if (pair.bodyA.render.fillStyle === 'cyan') { // cold gas
            let speedMultiplier = COLD_SPEED/pair.bodyA.speed;
            Body.setVelocity(pair.bodyA, { 
                x: pair.bodyA.velocity.x*speedMultiplier, 
                y: pair.bodyA.velocity.y*speedMultiplier
            });
        }
        if (pair.bodyB.render.fillStyle === 'darkred') { // hot gas
            let speedMultiplier = HOT_SPEED/pair.bodyB.speed;
            Body.setVelocity(pair.bodyB, { 
                x: pair.bodyB.velocity.x*speedMultiplier, 
                y: pair.bodyB.velocity.y*speedMultiplier
            });
        }
    }
});

// populate with gas
var stack_left = Composites.stack(100, 100, 2, 2, 100, 100, createGas);
var stack_right = Composites.stack(500, 100, 2, 2, 100, 100, createGas);

World.add(world, [stack_left, stack_right, sensor]);

// run the engine
Engine.run(engine);

// run the renderer
Render.run(render);
