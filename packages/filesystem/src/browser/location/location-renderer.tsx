import URI from "@viz/core/lib/common/uri";
import { LocationService } from "./location-service";
import { ReactRenderer } from "@viz/core/lib/browser/widgets/react-renderer";
import * as React from 'react';

export const LOCATION_LIST_CLASS = 'theia-LocationList';

export class LocationListRenderer extends ReactRenderer {

    constructor(
        readonly service: LocationService,
        host?: HTMLElement
    ) {
        super(host);
    }

    render(): void {
        super.render();
        const locationList = this.locationList;
        if (locationList) {
            const currentLocation = this.service.location;
            locationList.value = currentLocation ? currentLocation.toString() : '';
        }
    }

    protected readonly handleLocationChanged = (e: React.ChangeEvent<HTMLSelectElement>) => this.onLocationChanged(e);
    protected doRender(): React.ReactNode {
        const location = this.service.location;
        const locations = location ? location.allLocations : [];
        const options = locations.map(value => this.renderLocation(value));
        return <select className={LOCATION_LIST_CLASS} onChange={this.handleLocationChanged}>{...options}</select>;
    }

    protected renderLocation(uri: URI): React.ReactNode {
        const value = uri.toString();
        return <option value={value} key={uri.toString()}>{uri.displayName}</option>;
    }

    protected onLocationChanged(e: React.ChangeEvent<HTMLSelectElement>): void {
        const locationList = this.locationList;
        if (locationList) {
            const value = locationList.value;
            const uri = new URI(value);
            this.service.location = uri;
        }
        e.preventDefault();
        e.stopPropagation();
    }

    get locationList(): HTMLSelectElement | undefined {
        const locationList = this.host.getElementsByClassName(LOCATION_LIST_CLASS)[0];
        if (locationList instanceof HTMLSelectElement) {
            return locationList;
        }
        return undefined;
    }

}
