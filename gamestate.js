/**
 * Provides an API for the rest of the AI scripts to query the world state at a
 * higher level than the raw data.
 */
var GameState = function(ai) {
	MemoizeInit(this);

	this.ai = ai;
	this.timeElapsed = ai.timeElapsed;
	this.templates = ai.templates;
	this.entities = ai.entities;
	this.playerData = ai.playerData;
	this.buildingsBuilt = 0;
};

GameState.prototype.getTimeElapsed = function() {
	return this.timeElapsed;
};

GameState.prototype.getTemplate = function(type) {
	if (!this.templates[type])
		return null;
	return new EntityTemplate(this.templates[type]);
};

GameState.prototype.applyCiv = function(str) {
	return str.replace(/\{civ\}/g, this.playerData.civ);
};

/**
 * @returns {Resources}
 */
GameState.prototype.getResources = function() {
	return new Resources(this.playerData.resourceCounts);
};

GameState.prototype.getMap = function() {
	return this.ai.map;
};

GameState.prototype.getPopulation = function() {
	return this.playerData.popCount;
};

GameState.prototype.getPopulationLimit = function() {
	return this.playerData.popLimit;
};

GameState.prototype.getPopulationMax = function() {
	return this.playerData.popMax;
};

GameState.prototype.getPassabilityClassMask = function(name) {
	if (!(name in this.ai.passabilityClasses))
		error("Tried to use invalid passability class name '" + name + "'");
	return this.ai.passabilityClasses[name];
};

GameState.prototype.getOwnEntities = (function() {
	return new EntityCollection(this.ai, this.ai._ownEntities);
}),

GameState.prototype.getOwnEntitiesWithRole = Memoize('getOwnEntitiesWithRole', function(role) {
	var metas = this.ai._entityMetadata;
	if (role === undefined)
		return this.getOwnEntities().filter_raw(function(ent) {
			var metadata = metas[ent.id];
			if (!metadata || !('role' in metadata))
				return true;
			return (metadata.role === undefined);
		});
	else
		return this.getOwnEntities().filter_raw(function(ent) {
			var metadata = metas[ent.id];
			if (!metadata || !('role' in metadata))
				return false;
			return (metadata.role === role);
		});
});

GameState.prototype.countEntitiesWithType = function(type) {
	var count = 0;
	this.getOwnEntities().forEach(function(ent) {
		var t = ent.templateName();
		if (t == type)
			++count;
	});
	return count;
};

GameState.prototype.countEntitiesAndQueuedWithType = function(type) {
	var foundationType = "foundation|" + type;
	var count = 0;
	this.getOwnEntities().forEach(function(ent) {

		var t = ent.templateName();
		if (t == type || t == foundationType)
			++count;

		var queue = ent.trainingQueue();
		if (queue) {
			queue.forEach(function(item) {
				if (item.template == type)
					count += item.count;
			});
		}
	});
	return count;
};

GameState.prototype.countEntitiesAndQueuedWithRole = function(role) {
	var count = 0;
	this.getOwnEntities().forEach(function(ent) {

		if (ent.getMetadata("role") == role)
			++count;

		var queue = ent.trainingQueue();
		if (queue) {
			queue.forEach(function(item) {
				if (item.metadata && item.metadata.role == role)
					count += item.count;
			});
		}
	});
	return count;
};

/**
 * Find buildings that are capable of training the given unit type, and aren't
 * already too busy.
 */
GameState.prototype.findTrainers = function(template) {
	var maxQueueLength = 3; // avoid tying up resources in giant training
	// queues

	return this.getOwnEntities().filter(function(ent) {

		var trainable = ent.trainableEntities();
		if (!trainable || trainable.indexOf(template) == -1)
			return false;

		var queue = ent.trainingQueue();
		if (queue) {
			if (queue.length >= maxQueueLength)
				return false;
		}

		return true;
	});
};

/**
 * Find units that are capable of constructing the given building type.
 */
GameState.prototype.findBuilders = function(template) {
	return this.getOwnEntities().filter(function(ent) {

		var buildable = ent.buildableEntities();
		if (!buildable || buildable.indexOf(template) == -1)
			return false;

		return true;
	});
};

GameState.prototype.findFoundations = function(template) {
	return this.getOwnEntities().filter(function(ent) {
		return (typeof ent.foundationProgress() !== "undefined");
	});
};

GameState.prototype.findResourceSupplies = function() {
	var supplies = {};
	this.entities.forEach(function(ent) {
		var type = ent.resourceSupplyType();
		if (!type)
			return;
		var amount = ent.resourceSupplyAmount();
		if (!amount)
			return;

		var reportedType;
		if (type.generic == "treasure")
			reportedType = type.specific;
		else
			reportedType = type.generic;

		if (!supplies[reportedType])
			supplies[reportedType] = [];

		supplies[reportedType].push({
			"entity" : ent,
			"amount" : amount,
			"type" : type,
			"position" : ent.position(),
		});
	});
	return supplies;
};