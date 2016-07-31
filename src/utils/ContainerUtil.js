import _ from 'underscore';
import docker from '../utils/DockerUtil';

var ContainerUtil = {
  env: function (container) {
    if (!container || !container.Config || !container.Config.Env) {
      return [];
    }
    return _.map(container.Config.Env, env => {
      var i = env.indexOf('=');
      return [env.slice(0, i), env.slice(i + 1)];
    });
  },

  // Provide Foreground options
  mode: function (container) {
    return [
        (container && container.Config) ? container.Config.Tty : true,
        (container && container.Config) ? container.Config.OpenStdin : true,
        (container && container.HostConfig) ? container.HostConfig.Privileged : false
    ];
  },

  links: function (container) {
    if (!container || !container.HostConfig || !container.HostConfig.Links) {
      return [];
    }
    return _.map(container.HostConfig.Links, link => {
      var i = link.indexOf(':');
      // Account for the slashes
      var keyStart, valStart;
      if (link.indexOf('/') != -1 && link.indexOf('/') < i) {
        keyStart = link.indexOf('/') + 1;
      } else {
        keyStart = 0;
      }
      if (link.lastIndexOf('/') != -1 && link.lastIndexOf('/') > i) {
        valStart = link.lastIndexOf('/') + 1;
      } else {
        valStart = i + 1;
      }
      return [link.slice(keyStart, i), link.slice(valStart)];
    });
  },


// TODO: inject host here instead of requiring Docker
  ports: function (container) {
    if (!container || !container.NetworkSettings) {
      return {};
    }
    var res = {};
    var ip = docker.host;
    var ports = (container.NetworkSettings.Ports) ? container.NetworkSettings.Ports : ((container.HostConfig.PortBindings) ? container.HostConfig.PortBindings : container.Config.ExposedPorts);
    _.each(ports, function (value, key) {
      var [dockerPort, portType] = key.split('/');
      var localUrl = null;
      var port = null;
      if (value && value.length) {
        port = value[0].HostPort;
      }
      localUrl = (port) ? ip + ':' + port : ip + ':' + '<not set>';

      res[dockerPort] = {
        url: localUrl,
        ip: ip,
        port: port,
        portType: portType
      };
    });
    return res;
  }
};

module.exports = ContainerUtil;
