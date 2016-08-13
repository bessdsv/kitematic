import _ from 'underscore';
import React from 'react/addons';
import metrics from '../utils/MetricsUtil';
import electron, { clipboard } from 'electron';
const remote = electron.remote;
const dialog = remote.dialog;
import ContainerUtil from '../utils/ContainerUtil';
import containerActions from '../actions/ContainerActions';
import util from '../utils/Util';
import containerStore from '../stores/ContainerStore';
import Typeahead from './Typeahead.react';

var ContainerSettingsLinks = React.createClass({
    mixins: [React.addons.LinkedStateMixin],

    contextTypes: {
        router: React.PropTypes.func
    },

    getInitialState: function () {
        let links = ContainerUtil.links(this.props.container) || [];
        links.push(['', '']);
        links = _.map(links, l => {
            return [util.randomId(), l[0], l[1]];
        });
        let containers = containerStore.getState().containers;
        let sorted = [];
        for(var prop in containers){
            if (containers.hasOwnProperty(prop) && containers[prop].Id != this.props.container.Id){
                sorted.push(containers[prop]);
            }
        }

        return {
            links: links,
            sorted: sorted
        };
    },

    handleSaveLinksVars: function () {
        metrics.track('Saved Linked Containers');
        let list = [];
        let keys = [];
        let newLinks = [];
        _.each(this.state.links, kvp => {
            let [, key, value] = kvp;
            if ((key && key.length) && (value && value.length)) {
                newLinks.push(kvp);
                let link = key + ':' + value;
                // Check if Container was previously added
                let currentKey = keys.indexOf(key);
                if ( currentKey != -1) {
                    list[currentKey] = link;
                } else {
                    keys.push(key);
                    list.push(link);
                }
            }
        });
        let runtimeConfig = _.extend(this.props.container.HostConfig, {Links: list.length ? list : null });
        containerActions.update(this.props.container.Name, {HostConfig: runtimeConfig});
        newLinks.push([util.randomId(), '', '']);
        this.setState({links : newLinks});
    },

    handleChangeLinksKey: function (index, event) {
        let links = _.map(this.state.links, _.clone);
        if (event && event[0]){
            links[index][1] = event[0]['Name'];
            links[index][2] = links[index][2] || event[0]['Name'] || "";
        } else {
            links[index][1] = "";
        }
        this.setState({
            links: links
        });
    },

    handleChangeLinksVal: function (index, event) {
        let links = _.map(this.state.links, _.clone);
        links[index][2] = event.target.value;
        this.setState({
            links: links
        });
    },

    handleAddLinksVar: function () {
        let links = _.map(this.state.links, _.clone);
        links.push([util.randomId(), '', '']);
        this.setState({
            links: links
        });
        metrics.track('Added Pending Linked Containers');
    },

    handleRemoveLinksVar: function (index) {
        let links = _.map(this.state.links, _.clone);
        links.splice(index, 1);

        if (links.length === 0) {
            links.push([util.randomId(), '', '']);
        }

        this.setState({
            links: links
        });

        metrics.track('Removed Linked Containers');
    },

    render: function () {
        if (!this.props.container) {
            return false;
        }

        let _state = this.state;

        let links = _.map(this.state.links, (kvps, index) => {
            let [id, key, val] = kvps;
            let icon;
            if (index === _state.links.length - 1) {
                icon = <a onClick={this.handleAddLinksVar} className="only-icon btn btn-positive small"><span className="icon icon-add"></span></a>;
            } else {
                icon = <a onClick={this.handleRemoveLinksVar.bind(this, index)} className="only-icon btn btn-action small"><span className="icon icon-delete"></span></a>;
            }

            let inputDockerContainer = (
                <Typeahead
                    onChange={this.handleChangeLinksKey.bind(this, index)}
                    //refs="typeahead"
                    className="key line"
                    labelKey="Name"
                    options={_state.sorted}
                    selected={ key != "" ? _.where(_state.sorted, {Name: key}) : []}
                    />
            );
            return (
                <tr>
                    <td>{inputDockerContainer}</td>
                    <td><input type="text" ref="link-val" className="val line" oldValue={val} value={val} defaultValue={val} onChange={this.handleChangeLinksVal.bind(this, index)} /></td>
                    <td>
                        {icon}
                    </td>
                </tr>
            );
        });

        return (
            <div className="settings-panel">
            <div className="settings-section">
                <h3>Configure Linked Containers</h3>
                <table className="table links">
                    <thead>
                    <tr>
                        <th>DOCKER CONTAINER</th>
                        <th>DOCKER ALIAS</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    {links}
                    </tbody>
                </table>
                <a className="btn btn-action" disabled={this.props.container.State.Updating} onClick={this.handleSaveLinksVars}>Save</a>
            </div>
            </div>
        );
    }
});

module.exports = ContainerSettingsLinks;