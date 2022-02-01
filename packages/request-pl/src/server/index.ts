
import type {PackageRecord} from "pinglue";
import {Controller, Registry} from "pinglue";
import {_merge} from "@pinglue/utils";

export default class extends Controller {

    bkdPkgs?: Map<string, PackageRecord>;

    async init() {

        this.glue(
            "frontend-packages-settings",
            this.frdSettingsHandler.bind(this)
        );

        const registry = new Registry({
            route: "backend",
            noImport: true
        });

        this.bkdPkgs = (await registry.load()).data;

    }

    async frdSettingsHandler(_, value) {

        // adding remote channels in backend (those marked by inFrontend flag in theri settings)
        const remoteChannelsSet = new Set<string>();

        if (this.bkdPkgs) {

            for(const record of this.bkdPkgs.values()) {

                if (
                    record.settings?.disabled ||
                    !record.channels
                )   continue;
                
                for(
                    const [channelName, info] of 
                    Object.entries(record.channels)
                ) {

                    if (info?.settings?.inFrontend)
                        remoteChannelsSet.add(channelName);
                }
            }
        }

        //this.mark("extra remote channels: ", remoteChannelsSet);

        
        // getting api route
        const settings = this.runS("get-server-settings");

        return {[this.pkgInfo.name]: {
            apiRoute: settings.apiRoute,
            remoteChannels: [...remoteChannelsSet]
        }};

    }

}