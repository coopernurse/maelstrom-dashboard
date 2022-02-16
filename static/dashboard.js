
function MaelConfig(opts) {
    return {
        showZeroRamNodes: false,
        maxColors: 10,
        refreshMillis: 10000
    };
}

function FormattedRunTime(startTime) {
	const now = new Date();
	secondsRunning = Math.round((now - startTime)/1000);
	if (secondsRunning > 86400) {
	    return Math.round(secondsRunning * 10 / 86400)/10 + "d";
	} else if (secondsRunning > 3600) {
		return Math.round(secondsRunning * 10 / 3600)/10 + "h";
	} else if (secondsRunning > 60) {
		return Math.round(secondsRunning * 10 / 60)/10 + "m";
	} else {
		return secondsRunning + "s";
	}
}

function MaelDashUI(config) {

    var ui = {};

    var nodes = [];
    var workerNodes = [];
    var stats = {
        containers: 0,
        reqPerSecond: 0,
        previousPollTime: null,
        previousReqCount: {}
    };

    var colorsByName = {};
    var colorIdx = 0;
    
    var getStatus = function() {
        var i, j;
        var pollTime = new Date().getTime();
        m.request({
            url: "/rpc/nodestatus",
        }).then(function(data) {
            var containers = 0;
            var totalRequests = 0;            
            var reqCountById = {};
            var id, comp, seconds;
            
            if (data.result.nodes) {
                nodes = data.result.nodes;
                workerNodes = filterWorkerNodes(nodes);
                
                // sort nodes by start time
                nodes.sort(function (a, b) { return (a.startedAt < b.startedAt) ? -1 : 1; });

                // compute # containers and requests per second
                for (i = 0; i < nodes.length; i++) {
                    for (j = 0; j < nodes[i].runningComponents.length; j++) {
                        comp = nodes[i].runningComponents[j];
                        id = comp.componentName + "_" + comp.startTime;
                        prevReqCount = stats.previousReqCount[id];
                        totalRequests += (prevReqCount > 0) ? comp.totalRequests - prevReqCount : comp.totalRequests;
                        reqCountById[id] = comp.totalRequests;
                        containers++;
                    }
                }

                if (stats.previousPollTime) {
                    seconds = (pollTime - stats.previousPollTime) / 1000.0;
                    stats.reqPerSecond = Math.round((totalRequests / seconds) * 10) / 10;
                }
                stats.containers = containers;
                stats.previousPollTime = pollTime;
                stats.previousReqCount = reqCountById;
            }
            setTimeout(getStatus, config.refreshMillis);
        });
    };

    var filterWorkerNodes = function() {
        return _.filter(nodes, function(n) { return config.showZeroRamNodes || n.totalMemoryMiB > 0; });
    };

    var colorClass = function(name) {
        clz = colorsByName[name];
        if (!clz) {
            clz = "color-" + colorIdx;
            colorsByName[name] = clz;
            colorIdx++;
            if (colorIdx >= config.maxColors) {
                colorIdx = 0;
            }            
        }
        return clz;
    };

    var nodeRamPctUsed = function(node) {
        if (node.totalMemoryMiB == 0 || node.freeMemoryMiB >= node.totalMemoryMiB) {
            return 0;
        }
        return (node.totalMemoryMiB - node.freeMemoryMiB) / node.totalMemoryMiB;
    };

    var nodeRamClass = function(node) {
        var pctUsed = nodeRamPctUsed(node);
        if (pctUsed > 0.75) {
            return "ram-high";
        } else if (pctUsed > 0.25) {
            return "ram-med";
        } else {
            return "ram-low";
        }
    };

    var nodeClasses = function(node) {
        return [
            nodeRamClass(node),
        ];
    };

    var componentClasses = function(comp) {
        return [
            colorClass(comp.componentName),
            "status-" + comp.status
        ];
    };

    var renderStat = function(label, value) {
        return m("span", {class: "stat"}, [
            m("span", {class: "label"}, label),
            m("span", {class: "value"}, value)
        ]);
    };

    var renderNode = function(node) {
        var components = node.runningComponents;

        // sort components by name, then start time
        components.sort(function (a, b) { return (a.componentName == b.componentName) ?
                                          ((a.startTime < b.startTime) ? -1 : 1) : ((a.componentName < b.componentName) ? -1 : 1); });
        return m("div", {class: "node " + nodeClasses(node).join(" ")}, [
            m("div", {class: "meta"}, [
                m("span", {class: "nodeId"}, node.nodeId.substr(0, 4)),
                m("span", {class: "time"}, "up: " + moment.duration(new Date().getTime()-node.startedAt).humanize()),                
                m("span", {class: "load"}, "load: " + node.loadAvg1m),
                m("span", {class: "ram"}, "ram: " + Math.round(nodeRamPctUsed(node) * 100) + "%")
            ]),
            m("div", {class: "meta"}, [
                m("span", {class: "cpus"}, "cpus: " + node.numCPUs),
                m("span", {class: "ip"}, "ip: " + node.peerUrl.split('/')[2].split(':')[0])
            ]),
            m("div", {class: "components"}, _.map(components, function(c) {
                return m("div", {class: "component " + componentClasses(c).join(" ")}, [
                    m("span", {class: "status"}, c.status),
                    m("span", {class: "req"}, c.totalRequests),                    
                    m("span", {class: "time"}, FormattedRunTime(c.startTime)),
                    m("span", {class: "name"}, c.componentName)
                ])
            }))
        ])
    }
    
    ui.Dashboard = {
        view: function() {
            return m("main", _.concat([
                m("div", {class: "top"}, [
                    m("span", {class: "title"}, "maelstrom dashboard"),
                    m("span", {class: "stats"}, [
                        renderStat("nodes", workerNodes.length),
                        renderStat("containers", stats.containers),
                        renderStat("rps", stats.reqPerSecond)
                    ])
                ])
            ], _.map(workerNodes, renderNode)));
        }
    };

    getStatus();

    return ui;
}
