/*!
 * Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as immutable from 'immutable'
import { ActionsObservable } from 'redux-observable'
import { Observable } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { fetchRegionsSuccess, RegionAction, RegionsAction } from '../../actions/lambda/regions'

interface RegionsObservableProvider {
    regions$: Observable<{
        [code: string]: string
    }>
}

export function regionEpic(
    action$: ActionsObservable<RegionsAction | RegionAction>,
    regionsProvider: RegionsObservableProvider
) {
    return action$.ofType('FETCH_REGIONS_START').pipe(switchMap(
        action => regionsProvider.regions$.pipe(
            map(regions => immutable.fromJS(regions) as immutable.Map<string, string>),
            map(fetchRegionsSuccess)
        )
    ))
}
