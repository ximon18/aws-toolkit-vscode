/*!
 * Copyright 2018-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import * as nls from 'vscode-nls'
const localize = nls.loadMessageBundle()

import { S3 } from 'aws-sdk'
import * as path from 'path'
import * as vscode from 'vscode'
import { DefaultS3Client } from '../../shared/clients/defaultS3Client'
import { S3Client } from '../../shared/clients/s3Client'
import { samDeployDocUrl } from '../../shared/constants'
import { getLogger } from '../../shared/logger'
import { RegionProvider } from '../../shared/regions/regionProvider'
import { createHelpButton } from '../../shared/ui/buttons'
import * as input from '../../shared/ui/input'
import * as picker from '../../shared/ui/picker'
import { difference, filter, toArrayAsync } from '../../shared/utilities/collectionUtils'
import { configureParameterOverrides } from '../config/configureParameterOverrides'
import { detectLocalTemplates } from '../local/detectLocalTemplates'
import { getOverriddenParameters, getParameters } from '../utilities/parameterUtils'
import { MultiStepWizard, WizardStep } from './multiStepWizard'

export interface SamDeployWizardResponse {
    parameterOverrides: Map<string, string>
    region: string
    template: vscode.Uri
    s3Bucket: string
    stackName: string
}

export const enum ParameterPromptResult {
    Cancel,
    Continue
}

export interface SamDeployWizardContext {
    readonly onDetectLocalTemplates: typeof detectLocalTemplates

    readonly workspaceFolders: vscode.Uri[] | undefined

    /**
     * Returns the parameters in the specified template, or `undefined`
     * if the template does not include a `Parameters` section. `required`
     * is set to `true` if the parameter does not have a default value.
     *
     * @param templateUri The URL of the SAM template to inspect.
     */
    getParameters: typeof getParameters

    /**
     * Returns the names and values of parameters from the specified template
     * that have been overridden in `templates.json`, or `undefined` if `templates.json`
     * does not include a `parameterOverrides` section for the specified template.
     *
     * @param templateUri
     */
    getOverriddenParameters: typeof getOverriddenParameters

    /**
     * Retrieves the URI of a Sam template to deploy from the user
     *
     * @returns vscode.Uri of a Sam Template. undefined represents cancel.
     */
    promptUserForSamTemplate(initialValue?: vscode.Uri): Promise<vscode.Uri | undefined>

    /**
     * Prompts the user to configure parameter overrides, then either pre-fills and opens
     * `templates.json`, or returns true.
     *
     * @param options.templateUri The URL of the SAM template to inspect.
     * @param options.missingParameters The names of required parameters that are not yet overridden.
     * @returns A value indicating whether the wizard should proceed. `false` if `missingParameters` was
     *          non-empty, or if it was empty and the user opted to configure overrides instead of continuing.
     */
    promptUserForParametersIfApplicable(
        options: {
            templateUri: vscode.Uri
            missingParameters?: Set<string>
        }
    ): Promise<ParameterPromptResult>

    promptUserForRegion(regionProvider: RegionProvider, initialValue?: string): Promise<string | undefined>

    /**
     * Retrieves an S3 Bucket to deploy to from the user.
     *
     * @param initialValue Optional, Initial value to prompt with
     *
     * @returns S3 Bucket name. Undefined represents cancel.
     */
    promptUserForS3Bucket(selectedRegion?: string, initialValue?: string): Promise<string | undefined>

    /**
     * Retrieves a Stack Name to deploy to from the user.
     *
     * @param initialValue Optional, Initial value to prompt with
     * @param validateInput Optional, validates input as it is entered
     *
     * @returns Stack name. Undefined represents cancel.
     */
    promptUserForStackName(
        {
            initialValue,
            validateInput,
        }: {
            initialValue?: string
            validateInput(value: string): string | undefined
        }
    ): Promise<string | undefined>
}

function getSingleResponse(responses: vscode.QuickPickItem[] | undefined): string | undefined {
    if (!responses) {
        return undefined
    }

    if (responses.length !== 1) {
        throw new Error(`Expected a single response, but got ${responses.length}`)
    }

    return responses[0].label
}

export class DefaultSamDeployWizardContext implements SamDeployWizardContext {
    public readonly onDetectLocalTemplates = detectLocalTemplates
    public readonly getParameters = getParameters
    public readonly getOverriddenParameters = getOverriddenParameters
    private readonly helpButton = createHelpButton(
        this.extContext,
        localize(
            'AWS.command.help',
            'View Documentation'
        )
    )
    // this represents a cache that is created once per wizard load.
    // key: region code, value: array of buckets in the region
    // if we wish to change the frequency of this cache, remove `readonly` so you can reassign later
    private readonly bucketsByRegion: Map<string, string[]> = new Map<string, string[]>()
    private populatedBucketsByRegion: boolean = false

    public constructor(private readonly extContext: Pick<vscode.ExtensionContext, 'asAbsolutePath'>) {
    }

    public get workspaceFolders(): vscode.Uri[] | undefined {
        return (vscode.workspace.workspaceFolders || []).map(f => f.uri)
    }

    /**
     * Retrieves the URI of a Sam template to deploy from the user
     *
     * @returns vscode.Uri of a Sam Template. undefined represents cancel.
     */
    public async promptUserForSamTemplate(initialValue?: vscode.Uri): Promise<vscode.Uri | undefined> {
        const workspaceFolders = this.workspaceFolders || []

        const quickPick = picker.createQuickPick<SamTemplateQuickPickItem>({
            options: {
                ignoreFocusOut: true,
                title: localize(
                    'AWS.samcli.deploy.template.prompt',
                    'Which SAM Template would you like to deploy to AWS?'
                )
            },
            buttons: [
                this.helpButton,
                vscode.QuickInputButtons.Back
            ],
            items: await getTemplateChoices(this.onDetectLocalTemplates, ...workspaceFolders)
        })

        const choices = await picker.promptUser({
            picker: quickPick,
            onDidTriggerButton: (button, resolve, reject) => {
                if (button === vscode.QuickInputButtons.Back) {
                    resolve(undefined)
                } else if (button === this.helpButton) {
                    vscode.env.openExternal(vscode.Uri.parse(samDeployDocUrl))
                }
            }
        })
        const val = picker.verifySinglePickerOutput<SamTemplateQuickPickItem>(choices)

        return val ? val.uri : undefined
    }

    public async promptUserForParametersIfApplicable(
        {
            templateUri,
            missingParameters = new Set<string>()
        }: {
            templateUri: vscode.Uri
            missingParameters?: Set<string>
        }
    ): Promise<ParameterPromptResult> {
        if (missingParameters.size < 1) {
            const prompt = localize(
                'AWS.samcli.deploy.parameters.optionalPrompt.message',
                'The template {0} contains parameters. ' +
                'Would you like to override the default values for these parameters?',
                templateUri.fsPath
            )
            const responseYes = localize(
                'AWS.samcli.deploy.parameters.optionalPrompt.responseYes',
                'Yes'
            )
            const responseNo = localize(
                'AWS.samcli.deploy.parameters.optionalPrompt.responseNo',
                'No'
            )

            const quickPick = picker.createQuickPick<vscode.QuickPickItem>({
                options: {
                    ignoreFocusOut: true,
                    title: prompt
                },
                buttons: [
                    this.helpButton,
                    vscode.QuickInputButtons.Back
                ],
                items: [
                    { label: responseYes },
                    { label: responseNo }
                ]
            })
            const response = getSingleResponse(await picker.promptUser({
                picker: quickPick,
                onDidTriggerButton: (button, resolve, reject) => {
                    if (button === vscode.QuickInputButtons.Back) {
                        resolve(undefined)
                    } else if (button === this.helpButton) {
                        vscode.env.openExternal(vscode.Uri.parse(samDeployDocUrl))
                    }
                }
            }))
            if (response !== responseYes) {
                return ParameterPromptResult.Continue
            }

            await configureParameterOverrides({
                templateUri,
                requiredParameterNames: missingParameters.keys()
            })

            return ParameterPromptResult.Cancel
        } else {
            const prompt = localize(
                'AWS.samcli.deploy.parameters.mandatoryPrompt.message',
                'The template {0} contains parameters without default values. ' +
                'In order to deploy, you must provide values for these parameters. ' +
                'Configure them now?',
                templateUri.fsPath
            )
            const responseConfigure = localize(
                'AWS.samcli.deploy.parameters.mandatoryPrompt.responseConfigure',
                'Configure'
            )
            const responseCancel = localize(
                'AWS.samcli.deploy.parameters.mandatoryPrompt.responseCancel',
                'Cancel'
            )

            const quickPick = picker.createQuickPick<vscode.QuickPickItem>({
                options: {
                    ignoreFocusOut: true,
                    title: prompt
                },
                buttons: [
                    this.helpButton,
                    vscode.QuickInputButtons.Back
                ],
                items: [
                    { label: responseConfigure },
                    { label: responseCancel }
                ]
            })
            const response = getSingleResponse(await picker.promptUser({
                picker: quickPick,
                onDidTriggerButton: (button, resolve, reject) => {
                    if (button === vscode.QuickInputButtons.Back) {
                        resolve(undefined)
                    } else if (button === this.helpButton) {
                        vscode.env.openExternal(vscode.Uri.parse(samDeployDocUrl))
                    }
                }
            }))
            if (response === responseConfigure) {
                await configureParameterOverrides({
                    templateUri,
                    requiredParameterNames: missingParameters.keys()
                })
            }

            return ParameterPromptResult.Cancel
        }
    }

    public async promptUserForRegion(
        regionProvider: RegionProvider,
        initialRegionCode: string
    ): Promise<string | undefined> {
        const regionData = await regionProvider.getRegionData()

        if (this.bucketsByRegion.size === 0) {
            for (const regionDatum of regionData) {
                // populate the bucketsByRegion map with empty arrays here
                // that way, we can push into the arrays without worrying whether or not they exist
                // and avoid all of the async concerns that come with that
                this.bucketsByRegion.set(regionDatum.regionCode, [])
            }
        }

        const quickPick = picker.createQuickPick<vscode.QuickPickItem>({
            options: {
                title: localize(
                    'AWS.samcli.deploy.region.prompt',
                    'Which AWS Region would you like to deploy to?'
                    ),
                value: initialRegionCode || '',
                matchOnDetail: true,
                ignoreFocusOut: true,
            },
            items: regionData.map(r => (
                {
                    label: r.regionName,
                    detail: r.regionCode,
                    // this is the only way to get this to show on going back
                    // this will make it so it always shows even when searching for something else
                    alwaysShow: r.regionCode === initialRegionCode,
                    description: r.regionCode === initialRegionCode ?
                        localize('AWS.samcli.wizard.selectedPreviously', 'Selected Previously') : ''
                }
            )),
            buttons: [
                this.helpButton,
                vscode.QuickInputButtons.Back
            ],
        })

        const choices = await picker.promptUser<vscode.QuickPickItem>({
            picker: quickPick,
            onDidTriggerButton: (button, resolve, reject) => {
                if (button === vscode.QuickInputButtons.Back) {
                    resolve(undefined)
                } else if (button === this.helpButton) {
                    vscode.env.openExternal(vscode.Uri.parse(samDeployDocUrl))
                }
            }
        })
        const val = picker.verifySinglePickerOutput(choices)

        return val ? val.detail : undefined
    }

    /**
     * Prompts user to select a bucket from a regionalized list of S3 buckets
     * Caches buckets for the entire Wizard run the first time it hits this step
     * Allows the user to go back a step if the selected region doesn't have any buckets
     *
     * @param selectedRegion Region selected in the last step. Used to focus S3 bucket list
     * @param initialValue Optional, Initial value to prompt with
     * @param s3client Optional, S3 client (defaults to DefaultS3Client)
     *
     * @returns S3 Bucket name. Undefined represents back.
     */
    public async promptUserForS3Bucket(
        selectedRegion: string,
        initialValue?: string,
        s3Client: S3Client = new DefaultS3Client(selectedRegion)
    ): Promise<string | undefined> {

        const loadingBuckets = localize(
            'AWS.samcli.deploy.s3bucket.loading',
            'Loading S3 buckets...',
        )

        const quickPick = picker.createQuickPick<vscode.QuickPickItem>({
            buttons: [
                this.helpButton,
                vscode.QuickInputButtons.Back
            ],
            options: {
                title: localize(
                    'AWS.samcli.deploy.s3Bucket.prompt',
                    'Enter the AWS S3 bucket to which your code should be deployed'
                ),
                value: initialValue || '',
                matchOnDetail: true,
                ignoreFocusOut: true,
            },
            // preloaded "busy screen" message
            // using a const in case we want to make this clickable as a way to abort the lookup.
            items: [
                {
                    label: loadingBuckets
                }
            ],
        })

        // throw up a busy screen while the S3 buckets are loading
        picker.makeQuickPickBusy(quickPick)
        quickPick.show()

        let listBucketsResponse: S3.ListBucketsOutput | undefined
        let bucketMessage: string | undefined
        let bucketError: string | undefined
        // does the cache have any entries? If so, don't list buckets
        if (!this.populatedBucketsByRegion) {
            try {
                listBucketsResponse = await s3Client.listBuckets()

                // sort through buckets and add to cache if you had to run a listBuckets
                if (listBucketsResponse && listBucketsResponse.Buckets) {
                    // listBuckets lists all buckets tied to an account regardless of region
                    // we need to filter the list ourselves since we do care about the region
                    await addBucketsToRegionMap(listBucketsResponse.Buckets, this.bucketsByRegion, s3Client)
                    // you've successfully added buckets to regions. Cool. Now don't do it again.
                    this.populatedBucketsByRegion = true
                }

            } catch (err) {
                // user doesn't have access to region for some reason
                // change bucketError message
                const error = err as Error
                bucketMessage = localize(
                    'AWS.samcli.deploy.s3bucket.error',
                    'There was a problem accessing S3 in region {0}',
                    selectedRegion
                )
                bucketError = error.message
            }

        }
        // does the selected region have buckets? If so, add to the QP
        const regionBucket = this.bucketsByRegion.get(selectedRegion)
        let buckets: vscode.QuickPickItem[] | undefined
        if (regionBucket && regionBucket.length > 0) {
            // turn these into quick pick items
            buckets = createBucketQuickPickItems(regionBucket, initialValue)
        }
        // add the buckets to the QP OR add a message that buckets don't exist (and prompt to go back)
        if (buckets && buckets.length > 0) {
            quickPick.items = buckets.sort((a, b) => {
                if (a.label < b.label) {
                    return -1
                } else {
                    return 1
                }
            })
        } else {
            bucketMessage = bucketMessage || localize(
                'AWS.samcli.deploy.s3bucket.error.none',
                'You do not have access to any S3 buckets in {0}',
                selectedRegion
            )
            quickPick.items = [
                {
                    label: bucketMessage,
                    detail: bucketError,
                    description: localize(
                        'AWS.samcli.deploy.s3bucket.error.none.description',
                        'Go back to region selection...'
                    )
                }
            ]
        }

        // loading is done, restore to a selectable state
        picker.makeQuickPickNotBusy(quickPick)

        const pickedItem =  await picker.promptUser<vscode.QuickPickItem>({
            picker: quickPick,
            onDidTriggerButton: (button, resolve, reject) => {
                if (button === vscode.QuickInputButtons.Back) {
                    resolve(undefined)
                } else if (button === this.helpButton) {
                    vscode.env.openExternal(vscode.Uri.parse(samDeployDocUrl))
                }
            }
        })

        const val = picker.verifySinglePickerOutput(pickedItem)

        return (val && val.label !== bucketMessage) ? val.label : undefined
    }

    /**
     * Retrieves a Stack Name to deploy to from the user.
     *
     * @param initialValue Optional, Initial value to prompt with
     * @param validateInput Optional, validates input as it is entered
     *
     * @returns Stack name. Undefined represents cancel.
     */
    public async promptUserForStackName(
        {
            initialValue,
            validateInput,
        }: {
            initialValue?: string
            validateInput(value: string): string | undefined
        }
    ): Promise<string | undefined> {
        const inputBox = input.createInputBox({
            buttons: [
                this.helpButton,
                vscode.QuickInputButtons.Back
            ],
            options: {
                title: localize(
                    'AWS.samcli.deploy.stackName.prompt',
                    'Enter the name to use for the deployed stack'
                ),
                ignoreFocusOut: true,
            }
        })

        // Pre-populate the value if it was already set
        if (initialValue) {
            inputBox.value = initialValue
        }

        return await input.promptUser({
            inputBox: inputBox,
            onValidateInput: validateInput,
            onDidTriggerButton: (button, resolve, reject) => {
                if (button === vscode.QuickInputButtons.Back) {
                    resolve(undefined)
                } else if (button === this.helpButton) {
                    vscode.env.openExternal(vscode.Uri.parse(samDeployDocUrl))
                }
            }
        })
    }
}

export class SamDeployWizard extends MultiStepWizard<SamDeployWizardResponse> {
    private readonly response: Partial<SamDeployWizardResponse> = {}

    public constructor(
        private readonly regionProvider: RegionProvider,
        private readonly context: SamDeployWizardContext
    ) {
        super()
    }

    protected get startStep() {
        return this.TEMPLATE
    }

    protected getResult(): SamDeployWizardResponse | undefined {
        if (
            !this.response.parameterOverrides ||
            !this.response.template ||
            !this.response.region ||
            !this.response.s3Bucket ||
            !this.response.stackName
        ) {
            return undefined
        }

        return {
            parameterOverrides: this.response.parameterOverrides,
            template: this.response.template,
            region: this.response.region,
            s3Bucket: this.response.s3Bucket,
            stackName: this.response.stackName
        }
    }

    private readonly TEMPLATE: WizardStep = async () => {
        this.response.template = await this.context.promptUserForSamTemplate(this.response.template)

        return this.response.template ? this.PARAMETER_OVERRIDES : undefined
    }

    private readonly PARAMETER_OVERRIDES: WizardStep = async () => {
        const getNextStep = (result: ParameterPromptResult) => {
            switch (result) {
                case ParameterPromptResult.Cancel:
                    return undefined
                case ParameterPromptResult.Continue:
                    return this.REGION
            }
        }

        if (!this.response.template) {
            throw new Error('Unexpected state: TEMPLATE step is complete, but no template was selected')
        }

        const parameters = await this.context.getParameters(this.response.template)
        if (parameters.size < 1) {
            this.response.parameterOverrides = new Map<string, string>()

            return this.REGION
        }

        const requiredParameterNames = new Set<string>(
            filter(parameters.keys(), name => parameters.get(name)!.required)
        )
        const overriddenParameters = await this.context.getOverriddenParameters(this.response.template)
        if (!overriddenParameters) {
            // In there are no missing required parameters case, it isn't mandatory to override any parameters,
            // but we still want to inform users of the option to override. Once we have prompted (i.e., if the
            // parameter overrides section is empty instead of undefined), don't prompt again unless required.
            const options = {
                templateUri: this.response.template,
                missingParameters: requiredParameterNames.size > 0 ? requiredParameterNames : undefined
            }

            this.response.parameterOverrides = new Map<string, string>()

            return getNextStep(await this.context.promptUserForParametersIfApplicable(options))
        }

        const missingParameters = difference(requiredParameterNames, overriddenParameters.keys())
        if (missingParameters.size > 0) {
            return getNextStep(await this.context.promptUserForParametersIfApplicable({
                templateUri: this.response.template,
                missingParameters
            }))
        }

        this.response.parameterOverrides = overriddenParameters

        return this.REGION
    }

    private readonly REGION: WizardStep = async () => {
        this.response.region = await this.context.promptUserForRegion(this.regionProvider, this.response.region)

        // The PARAMETER_OVERRIDES step is part of the TEMPLATE step from the user's perspective,
        // so we go back to the TEMPLATE step instead of PARAMETER_OVERRIDES.
        return this.response.region ? this.S3_BUCKET : this.TEMPLATE
    }

    private readonly S3_BUCKET: WizardStep = async () => {
        this.response.s3Bucket = await this.context.promptUserForS3Bucket(this.response.region, this.response.s3Bucket)

        return this.response.s3Bucket ? this.STACK_NAME : this.REGION
    }

    private readonly STACK_NAME: WizardStep = async () => {
        this.response.stackName = await this.context.promptUserForStackName({
            initialValue: this.response.stackName,
            validateInput: validateStackName,
        })

        return this.response.stackName ? undefined : this.S3_BUCKET
    }
}

class SamTemplateQuickPickItem implements vscode.QuickPickItem {
    public readonly label: string

    public description?: string
    public detail?: string

    public constructor(
        public readonly uri: vscode.Uri,
        showWorkspaceFolderDetails: boolean,
    ) {
        this.label = SamTemplateQuickPickItem.getLabel(uri)

        if (showWorkspaceFolderDetails) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)

            if (workspaceFolder) {
                this.description = `in ${workspaceFolder.uri.fsPath}`
            }
        }
    }

    public compareTo(rhs: SamTemplateQuickPickItem): number {
        const labelComp = this.label.localeCompare(rhs.label)
        if (labelComp !== 0) {
            return labelComp
        }

        const descriptionComp = (this.description || '').localeCompare(rhs.description || '')
        if (descriptionComp !== 0) {
            return descriptionComp
        }

        return (this.detail || '').localeCompare(rhs.detail || '')
    }

    public static getLabel(uri: vscode.Uri): string {
        const logger = getLogger()
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)

        if (workspaceFolder) {
            // If workspace is /usr/foo/code and uri is /usr/foo/code/processor/template.yaml,
            // show "processor/template.yaml"
            return path.relative(workspaceFolder.uri.fsPath, uri.fsPath)
        }

        // We shouldn't find sam templates outside of a workspace folder. If we do, show the full path.
        logger.warn(
            `Unexpected situation: detected SAM Template ${uri.fsPath} not found within a workspace folder.`
        )

        return uri.fsPath
    }
}

// https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_CreateStack.html
// A stack name can contain only alphanumeric characters (case sensitive) and hyphens.
// It must start with an alphabetic character and cannot be longer than 128 characters.
function validateStackName(value: string): string | undefined {
    if (!/^[a-zA-Z\d\-]+$/.test(value)) {
        return localize(
            'AWS.samcli.deploy.stackName.error.invalidCharacters',
            'A stack name may contain only alphanumeric characters (case sensitive) and hyphens'
        )
    }

    if (!/^[a-zA-Z]/.test(value)) {
        return localize(
            'AWS.samcli.deploy.stackName.error.firstCharacter',
            'A stack name must begin with an alphabetic character'
        )
    }

    if (value.length > 128) {
        return localize(
            'AWS.samcli.deploy.stackName.error.length',
            'A stack name must not be longer than 128 characters'
        )
    }

    // TODO: Validate that a stack with this name does not already exist.

    return undefined
}

async function getTemplateChoices(
    onDetectLocalTemplates: typeof detectLocalTemplates = detectLocalTemplates,
    ...workspaceFolders: vscode.Uri[]
): Promise<SamTemplateQuickPickItem[]> {
    const uris = await toArrayAsync(onDetectLocalTemplates({ workspaceUris: workspaceFolders }))

    const uriToLabel: Map<vscode.Uri, string> = new Map<vscode.Uri, string>()
    const labelCounts: Map<string, number> = new Map()

    uris.forEach(uri => {
        const label = SamTemplateQuickPickItem.getLabel(uri)
        uriToLabel.set(uri, label)
        labelCounts.set(label, 1 + (labelCounts.get(label) || 0))
    })

    return Array.from(
        uriToLabel,
        ([uri, label]) => {
            const showWorkspaceFolderDetails: boolean = (labelCounts.get(label) || 0) > 1

            return new SamTemplateQuickPickItem(uri, showWorkspaceFolderDetails)
        }
    )
        .sort((a, b) => a.compareTo(b))
}

export async function addBucketsToRegionMap(
    buckets: S3.Bucket[],
    bucketsByRegion: Map<string, string[]>,
    s3Client: S3Client
): Promise<void> {
    const promises = buckets
        .filter(bucket => bucket.Name)
        .map(async bucket => {
            const bucketLocation = await s3Client.getBucketLocation(bucket.Name!)
            const transformedLocation = normalizeLocation(bucketLocation.LocationConstraint)
            addBucketToRegionMap(bucket.Name!, bucketsByRegion, transformedLocation)
        })

    await Promise.all(promises)
}

// correct blank and 'EU' locations:
// https://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
export function normalizeLocation(location?: string): string {
    if (!location || location === '') {
        location = 'us-east-1'
    } else if (location === 'EU') {
        location = 'eu-west-1'
    }

    return location
}
export function addBucketToRegionMap(bucket: string, bucketsByRegion: Map<string, string[]>, region: string) {
    // just in case the region doesn't exist. This should already be populated
    if (!bucketsByRegion.has(region)) {
        bucketsByRegion.set(region, [])
    }
    bucketsByRegion.get(region)!.push(bucket)
}

export function createBucketQuickPickItems(
    bucketsInRegion: string[],
    initialValue?: string
): vscode.QuickPickItem[] {
    // turn these into quick pick items
    return bucketsInRegion.map(b => (
        {
            label: b!,
            // this is the only way to get this to show on going back
            // this will make it so it always shows even when searching for something else
            alwaysShow: b === initialValue,
            description: b === initialValue ?
                localize('AWS.samcli.wizard.selectedPreviously', 'Selected Previously') : ''
        }
    ))
}
