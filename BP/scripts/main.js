import * as server from "@minecraft/server"
import * as ui from "@minecraft/server-ui"

let dim = server.world.getDimension("overworld");

let useMap = new Map();

let damage = 150;
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

    let player = event.source;

    dim.runCommand(`playsound nano.cannon.charge @a[r=50] ${loc.x} ${loc.y} ${loc.z} 1.0 ${p}`)

    player.playSound("nano.cannon.charge", {
        pitch: p,
        volume: 0.55
    })

    let mvm = new server.MolangVariableMap();
    mvm.setSpeedAndDirection("variable.velocity", 100, { x: 0, y: 1, z: 0 });
    mvm.setVector3("variable.scale", { x: 0.5, y: 0.5, z: 0.5 })
    let progress = 0;
    let chargeInterval = server.system.runInterval(() => {
        try {
            let loc = player.getHeadLocation();
            let pvd = rotateVectorY(player.getViewDirection(), 25);

            dim.spawnParticle("minecraft:blue_flame_particle", { x: loc.x + pvd.x, y: loc.y + pvd.y, z: loc.z + pvd.z }, mvm);

            // zoom
            player.camera.setCamera()

            progress++;
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
    let phl = player.getHeadLocation();

    // camera shake
    player.runCommand("camerashake add @s 0.5 0.5 positional");
    player.runCommand("camerashake add @s 0.1 0.5 rotational");

    let d = { x: pvd.x * 150, y: pvd.y * 150, z: pvd.z * 150 }
    let hitBlock = false;

    let entities = player.dimension.getEntitiesFromRay(player.getHeadLocation(), pvd, {
        maxDistance: 191,
        includePassableBlocks: false,
    })
    if (entities.length > 1) {
        for (let i = 0; i < entities.length; i++) {
            let entity = entities[i].entity;
            if (entity.nameTag != player.nameTag && entity.hasComponent(server.EntityComponentTypes.Health)) {
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
        maxDistance: 191,
        includePassableBlocks: false,
    })
    if (block) {
        d = block.block.location;
        hitBlock = true;
        // logic
        try {
            dim.createExplosion(block.block.location, explosionSize, {
                breaksBlocks: true,
                causesFire: true,
                source: player,
            })
        } catch (e) {
            // out of range
        }
    }
    let result = (hitBlock) ? d : { x: phl.x + d.x, y: phl.y + d.y, z: phl.z + d.z };
    spawnOnLine(phl, result, Math.floor(distance(player.getHeadLocation(), result) / 3) + 2);
})

//

class Slider {
    constructor(min = 0, max = 20, num = 5, step = 1) {
        this.min = min;
        this.max = max;
        this.num = num;
        this.step = step;
    }
}

class Dropdown {
    constructor(options = ["placeholder"]) {
        this.options = options;
        this.selected = 0;
    }
}

class Toggle {
    constructor(bool = false) {
        this.bool = bool;
    }
}

class ToggleGroup {
    constructor(names = []) {
        this.toggles = {};
        for (let name of names) {
            this.toggles[name] = new Toggle(false);
        }
    }

    resetToggleValues(names) {
        for (let name of names) {
            this.toggles = {};
            this.toggles[name] = new Toggle(false);
        }
    }

    getToggleValues() {
        let values = {};
        for (let [key, toggle] of Object.entries(this.toggles)) {
            values[key] = toggle.bool;
        }
        return values;
    }
}

class TextInput {
    constructor(text = "") {
        this.text = text;
    }
}

const structuresNameList = ["Structure1", "Structure2", "Structure3"];

// Updated list structure for the example
var list = {
    "ITEMS": {
        "Effect Accuracy": new Slider(0.05, 1.0, 0.5, 0.05),
        "Hit Effect Length": new Slider(0.05, 2.0, 0.5, 0.05),
        "Lingering Effect Length": new Slider(2.0, 8.0, 4.0, 0.25),
        "Gun Damage": new Slider(1, 20, 7, 1),
        "Gun Hardcore Mode?": new Toggle(false),
    },
    "MAZE GENERATION": {
        "Maze Size": new Slider(29, 199, 123, 2),
        "Player Count": new Slider(2, 19, 2, 1),
        "Wall Type": new Dropdown(["glass", "stonebrick"]),
        "Water Zone": new Toggle(false),
        "Loot Type": new Dropdown(["weak", "strong", "blicky"]),
    },
    "TOWERS": {
        "Tower Difficulty": new Dropdown(["custom", "easy", "hard", "both"]),
        "EASY": new ToggleGroup(structuresNameList),
        "HARD": {
            "tower3": new Toggle(false),
            "tower4": new Toggle(false),
        },
        "CENTERS": {
            "center1": new Toggle(false),
            "center2": new Toggle(false),
        }
    },
    "GROUP_3": {
        "Item 4": new Toggle(true),
        "Item 5": new Toggle(true),
        "Test Slider": new Slider(2.0, 8.0, 4.0, 0.25),
        "Test Text": new TextInput("Placeholder")
    }
};

function showMenu(entity, data, title = "Main Menu", stack = []) {
    let properties = {};
    let groups = {};

    for (let [key, value] of Object.entries(data)) {
        if (typeof value === "object" && !(value instanceof Slider) && !(value instanceof Dropdown) && !(value instanceof Toggle) && !(value instanceof TextInput) || (value instanceof ToggleGroup)) {
            groups[key] = value;
        } else {
            properties[key] = value;
        }
    }

    if (Object.keys(groups).length > 0 && Object.keys(properties).length > 0) {
        let form = new ui.ActionFormData();
        form.title(title);

        for (let groupName of Object.keys(groups)) {
            form.button(`${groupName}`);
        }

        for (let propName of Object.keys(properties)) {
            form.button(`Edit: ${propName}`);
        }

        form.button("<< Back");

        form.show(entity).then(response => {
            if (response.canceled || response.selection === Object.keys(groups).length + Object.keys(properties).length) {
                if (stack.length > 0) {
                    let previous = stack.pop();
                    showMenu(entity, previous.data, previous.title, stack);
                }
                return;
            }

            let index = response.selection;

            if (index < Object.keys(groups).length) {
                let selectedGroup = Object.keys(groups)[index];
                stack.push({ data, title });
                showMenu(entity, groups[selectedGroup], selectedGroup, stack);
            } else {
                let selectedProperty = Object.keys(properties)[index - Object.keys(groups).length];
                let singleProp = { [selectedProperty]: properties[selectedProperty] };
                stack.push({ data, title });
                showMenu(entity, singleProp, `Edit: ${selectedProperty}`, stack);
            }
        });
    } else if (Object.keys(groups).length > 0) {
        let form = new ui.ActionFormData();
        form.title(title);

        for (let groupName of Object.keys(groups)) {
            form.button(`${groupName}`);
        }

        form.button("<< Back");

        form.show(entity).then(response => {
            if (response.canceled || response.selection === Object.keys(groups).length) {
                if (stack.length > 0) {
                    let previous = stack.pop();
                    showMenu(entity, previous.data, previous.title, stack);
                }
                return;
            }

            let selectedGroup = Object.keys(groups)[response.selection];
            stack.push({ data, title });
            showMenu(entity, groups[selectedGroup], selectedGroup, stack);
        });
    } else if (Object.keys(properties).length > 0) {
        let modalForm = new ui.ModalFormData();
        modalForm.title(title);

        for (let [key, value] of Object.entries(properties)) {
            if (value instanceof Slider) {
                modalForm.slider(key, value.min, value.max, value.step, value.num);
            } else if (value instanceof Toggle) {
                modalForm.toggle(key, value.bool);
            } else if (value instanceof Dropdown) {
                modalForm.dropdown(key, value.options, value.selected);
            } else if (value instanceof TextInput) {
                modalForm.textField(key, "", value.text);
            } else if (value instanceof ToggleGroup) {
                for (let [toggleKey, toggleValue] of Object.entries(value.toggles)) {
                    modalForm.toggle(toggleKey, toggleValue.bool);
                }
            }
        }

        modalForm.submitButton("Save");

        modalForm.show(entity).then(response => {
            if (response.canceled) {
                let previous = stack.pop();
                showMenu(entity, previous.data, previous.title, stack);
                return;
            }

            let formValues = response.formValues;
            let i = 0;
            for (let [key, value] of Object.entries(properties)) {
                if (value instanceof Slider) {
                    value.num = formValues[i];
                } else if (value instanceof Toggle) {
                    value.bool = formValues[i];
                } else if (value instanceof Dropdown) {
                    value.selected = formValues[i];
                } else if (value instanceof TextInput) {
                    value.text = formValues[i];
                } else if (value instanceof ToggleGroup) {
                    for (let toggleKey of Object.keys(value.toggles)) {
                        value.toggles[toggleKey].bool = formValues[i];
                        i++;
                    }
                    continue; // Skip incrementing i here since it's done in the loop
                }
                i++;
            }

            let previous = stack.pop();
            showMenu(entity, previous.data, previous.title, stack);
        });
    }
}

// Entry point for the script
server.system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.sourceEntity.typeId !== "minecraft:player") return;

    if (event.id === "nano:test") {
        showMenu(event.sourceEntity, list);
    }
});

server.world.afterEvents.playerBreakBlock.subscribe((event) => {
    let item = event.player.getComponent(server.EntityComponentTypes.Equippable).getEquipmentSlot(server.EquipmentSlot.Mainhand).getItem();
    if (!item) return;
    if (item.typeId != "bridge:mazium_pickaxe") return;
    let durComp = item.getComponent(server.ItemComponentTypes.Durability);
    if (!durComp) return;
    let enchComp = item.getComponent(server.ItemComponentTypes.Enchantable);
    if (enchComp) {
        if (enchComp.getEnchantment("unbreaking")) {
            let dc = item.getComponent(server.ItemComponentTypes.Durability).getDamageChance(enchComp.getEnchantment("unbreaking").level);
            let rn = Math.random() * 100
            if (rn <= dc) {
                durComp.damage += 1;
            } else {
                durComp.damage += 1;
            }
        } else {
            durComp.damage += 1;
        }
        event.player.getComponent(server.EntityComponentTypes.Equippable).setEquipment(server.EquipmentSlot.Mainhand, item);
    }
})