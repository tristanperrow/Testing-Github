import * as server from "@minecraft/server"

let dim = server.world.getDimension("overworld");

let useMap = new Map();

let damage = 20;
let explosionSize = 12;

function spawnOnLine(vec1, vec2, numParticles) {
    if (numParticles < 2) {
        console.error("Number of particles must be at least 2.");
        return;
    }

    for (let i = 0; i < numParticles; i++) {
        let t = i / (numParticles - 1); // Normalize t between 0 and 1
        let x = vec1.x + t * (vec2.x - vec1.x);
        let y = vec1.y + t * (vec2.y - vec1.y);
        let z = vec1.z + t * (vec2.z - vec1.z);

        try {
            //server.world.sendMessage(`Spawned ${i} at: ${x} ${y} ${z}`);
            dim.spawnParticle("minecraft:sonic_explosion", { x: x, y: y, z: z });
            dim.spawnParticle("minecraft:large_explosion", { x: x, y: y, z: z });
        } catch (e) {
            //
        }
    }
}

function distance(vec1, vec2) {
    return Math.sqrt(
        Math.pow(vec2.x - vec1.x, 2) +
        Math.pow(vec2.y - vec1.y, 2) +
        Math.pow(vec2.z - vec1.z, 2)
    );
}

function rotateVectorY(vector, angleDegrees) {
    const angleRadians = (Math.PI / 180) * angleDegrees; // Convert degrees to radians
    const cosAngle = Math.cos(angleRadians);
    const sinAngle = Math.sin(angleRadians);

    // Apply rotation matrix
    return {
        x: vector.x * cosAngle - vector.z * sinAngle,
        y: vector.y,
        z: vector.x * sinAngle + vector.z * cosAngle
    };
}

function rotateVectorX(vector, angleDegrees) {
    const angleRadians = (Math.PI / 180) * angleDegrees; // Convert degrees to radians
    const cosAngle = Math.cos(angleRadians);
    const sinAngle = Math.sin(angleRadians);

    // Apply rotation matrix
    return {
        x: vector.x,
        y: vector.y * cosAngle - vector.z * sinAngle,
        z: vector.y * sinAngle + vector.z * cosAngle
    };
}

server.world.afterEvents.itemStartUse.subscribe((event) => {
    if (event.itemStack.typeId != "bridge:energy_cannon") return;
    if (event.source.getItemCooldown("cannon_cooldown") > 0) return;

    let loc = event.source.location;
    let p = Math.random() * 0.3 + 0.85;

    dim.runCommand(`playsound nano.cannon.charge @a[r=50] ${loc.x} ${loc.y} ${loc.z} 1.0 ${p}`)

    event.source.playSound("nano.cannon.charge", {
        pitch: p,
        volume: 0.55
    })

    let mvm = new server.MolangVariableMap();
    mvm.setSpeedAndDirection("variable.velocity", 100, { x: 0, y: 1, z: 0 });
    mvm.setVector3("variable.scale", { x: 0.5, y: 0.5, z: 0.5 })
    let chargeInterval = server.system.runInterval(() => {
        try {
            let loc = event.source.getHeadLocation();
            let pvd = rotateVectorY(event.source.getViewDirection(), 25);

            dim.spawnParticle("minecraft:blue_flame_particle", { x: loc.x + pvd.x, y: loc.y + pvd.y, z: loc.z + pvd.z }, mvm);
        } catch (e) {
            // out of ticking area
        }
    }, 1)

    useMap.set(event.source.name, chargeInterval);
})

server.world.afterEvents.itemReleaseUse.subscribe((event) => {
    if (event.itemStack.typeId != "bridge:energy_cannon") return;
    if (event.source.getItemCooldown("cannon_cooldown") > 0) return;

    dim.runCommand(`stopsound "${event.source.name}" nano.cannon.charge`);

    if (useMap.has(event.source.name)) {
        server.system.clearRun(useMap.get(event.source.name));
        useMap.delete(event.source.name);
    }
})

server.world.afterEvents.itemUse.subscribe((event) => {
    if (event.itemStack.typeId != "bridge:energy_cannon") return;

    // Charge Particles

})

server.world.afterEvents.itemCompleteUse.subscribe((event) => {
    if (event.itemStack.typeId != "bridge:energy_cannon") return;

    let player = event.source;

    // check validity


    if (useMap.has(event.source.name)) {
        server.system.clearRun(useMap.get(event.source.name));
        useMap.delete(event.source.name);
    }

    // now run logic
    player.startItemCooldown("cannon_cooldown", 35)

    let p = Math.random() * 0.3 + 0.85;

    player.dimension.playSound("nano.cannon.fire", player.location, {
        pitch: p,
        volume: 1.0
    })

    let pvd = player.getViewDirection();

    // camera shake
    player.runCommand("camerashake add @s 0.5 0.5 positional");
    player.runCommand("camerashake add @s 0.1 0.5 rotational");


    let entities = player.dimension.getEntitiesFromRay(player.getHeadLocation(), pvd, {
        maxDistance: 150,
        includePassableBlocks: false,
    })
    if (entities.length > 1) {
        spawnOnLine(player.getHeadLocation(), entities[entities.length - 1].entity.location, Math.floor(entities[1].distance / 3) + 2);
        for (let i = 0; i < entities.length; i++) {
            let entity = entities[i].entity;
            if (entity.nameTag != player.nameTag) {
                entity.applyKnockback(pvd.x, pvd.z, 5, 0.4);
                entity.applyDamage(damage);
                // TODO make players take damage with `player.dimension.getPlayers({ location: player.location, maxDistance: 12 });`
                /*
                dim.createExplosion(entity.location, explosionSize, {
                    breaksBlocks: true,
                    causesFire: true,
                    source: player
                })
                */
            }
        }
        //return;
    }
    let block = player.dimension.getBlockFromRay(player.getHeadLocation(), pvd, {
        maxDistance: 150,
        includePassableBlocks: false,
    })
    if (block) {
        // spawn particles
        spawnOnLine(player.getHeadLocation(), block.block.location, Math.floor(distance(player.getHeadLocation(), block.block.location) / 3) + 2);
        // logic
        dim.createExplosion(block.block.location, explosionSize, {
            breaksBlocks: true,
            causesFire: true,
            source: player
        })
    }
})
