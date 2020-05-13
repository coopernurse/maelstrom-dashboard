
function MaelConfig(opts) {
    return {
        showZeroRamNodes: false,
        maxColors: 10,
        refreshMillis: 10000
    };
}

function MaelDashUI(config) {

    var ui = {};

    var nodes = [];

    var colorsByName = {};
    var colorIdx = 0;
    
    var getStatus = function() {
        m.request({
            url: "/rpc/nodestatus",
        }).then(function(data) {
            if (data.result.nodes) {
                nodes = data.result.nodes;
                // sort nodes by start time
                nodes.sort(function (a, b) { return (a.startedAt < b.startedAt) ? -1 : 1; });
            }
            setTimeout(getStatus, config.refreshMillis);
        });
    };

    var filterNodes = function() {
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
            m("div", {class: "components"}, _.map(components, function(c) {
                return m("div", {class: "component " + componentClasses(c).join(" ")}, [
                    m("span", {class: "status"}, c.status),
                    m("span", {class: "req"}, c.totalRequests),                    
                    m("span", {class: "name"}, c.componentName)
                ])
            }))
        ])
    }
    
    ui.Dashboard = {
        view: function() {
            return m("main", _.concat(
                [ m("h1", {class: "title"}, "maelstrom dashboard") ],
                _.map(filterNodes(), renderNode)
            ))
        }
    };

    getStatus();

    return ui;
}
