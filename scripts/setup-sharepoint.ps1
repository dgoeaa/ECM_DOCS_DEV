<#
.SYNOPSIS
    Creates the SharePoint lists, library and columns the platform's flows write into.

.DESCRIPTION
    Replaces Part B of docs/deployment/CLOUDFLARE.md — 24 columns clicked one at a time,
    where a single misspelling silently writes nothing for the life of the pilot.

    Safe to re-run. Every list and column is created only if it is missing, so if the script
    stops halfway you can simply run it again.

.PARAMETER SiteUrl
    The full SharePoint site URL, e.g. https://contoso.sharepoint.com/sites/NITDADGORegistry

.EXAMPLE
    ./setup-sharepoint.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/NITDADGORegistry"

.NOTES
    Requires PnP.PowerShell. If it is not installed:
        Install-Module PnP.PowerShell -Scope CurrentUser

    The date columns are deliberately Text, not DateTime. The platform reads and writes ISO
    8601 instants such as 2026-08-04T09:15:22.431Z. A SharePoint DateTime column converts
    those to a local-time serial value, and the exact instant — which is what an audit trail
    is for — is lost on the way in.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl
)

$ErrorActionPreference = 'Stop'

# ── the schema ───────────────────────────────────────────────────────────────────────────
# Names must match config and the flow field mappings exactly. Changing one here without
# changing it in the flow means that field silently stops being written.

$CorrespondenceFields = @(
    @{ Name = 'ReferenceId';            Type = 'Text';    Unique = $true }
    @{ Name = 'Subject';                Type = 'Note' }
    @{ Name = 'Category';               Type = 'Choice';  Choices = @(
        'Official Correspondence', 'Ministerial Directive', 'Application', 'Proposal',
        'Project Proposal', 'Report', 'Compliance Filing', 'Policy Submission',
        'Event Invitation', 'Meeting Request', 'General Correspondence') }
    @{ Name = 'CorrespondenceType';     Type = 'Text' }
    @{ Name = 'Channel';                Type = 'Text' }
    @{ Name = 'SenderName';             Type = 'Text' }
    @{ Name = 'SenderEmail';            Type = 'Text' }
    @{ Name = 'SenderOrganisation';     Type = 'Text' }
    @{ Name = 'SenderOrganisationType'; Type = 'Text' }
    @{ Name = 'SenderPhone';            Type = 'Text' }
    @{ Name = 'EventDate';              Type = 'Text' }
    @{ Name = 'Description';            Type = 'Note' }
    @{ Name = 'Status';                 Type = 'Choice';  Choices = @(
        'Received', 'Under Review', 'In Treatment', 'Awaiting Response', 'Completed', 'Closed') }
    @{ Name = 'StatusLabel';            Type = 'Text' }
    @{ Name = 'ReceivedAt';             Type = 'Text' }
    @{ Name = 'AcknowledgedAt';         Type = 'Text' }
    @{ Name = 'UpdatedAt';              Type = 'Text' }
    @{ Name = 'ClosedAt';               Type = 'Text' }
    @{ Name = 'ActionRequired';         Type = 'Boolean' }
    @{ Name = 'AttachmentManifest';     Type = 'Note' }
    @{ Name = 'AttachmentLink';         Type = 'URL' }
    @{ Name = 'DeclaredBytes';          Type = 'Number' }
    @{ Name = 'CorrelationId';          Type = 'Text' }
    @{ Name = 'Timeline';               Type = 'Note' }
)

$SupportCaseFields = @(
    @{ Name = 'CaseRef';         Type = 'Text'; Unique = $true }
    @{ Name = 'Name';            Type = 'Text' }
    @{ Name = 'Email';           Type = 'Text' }
    @{ Name = 'Topic';           Type = 'Text' }
    @{ Name = 'Message';         Type = 'Note' }
    @{ Name = 'AboutReference';  Type = 'Text' }
    @{ Name = 'ReceivedAt';      Type = 'Text' }
)

$DocumentFields = @(
    @{ Name = 'ReferenceId'; Type = 'Text' }
    @{ Name = 'Sha256';      Type = 'Text' }
)

# ── helpers ──────────────────────────────────────────────────────────────────────────────

$script:Created = 0
$script:Skipped = 0

function Ensure-List {
    param([string]$Title, [string]$Template)

    $existing = Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  = list '$Title' already exists" -ForegroundColor DarkGray
        return
    }
    New-PnPList -Title $Title -Template $Template -OnQuickLaunch | Out-Null
    Write-Host "  + created list '$Title'" -ForegroundColor Green
}

function Ensure-Field {
    param([string]$ListTitle, [hashtable]$Field)

    $name = $Field.Name
    $existing = Get-PnPField -List $ListTitle -Identity $name -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "    = $name" -ForegroundColor DarkGray
        $script:Skipped++
        return
    }

    $args = @{
        List        = $ListTitle
        DisplayName = $name
        InternalName= $name
        Type        = $Field.Type
        AddToDefaultView = $true
    }
    if ($Field.ContainsKey('Choices')) { $args['Choices'] = $Field.Choices }

    Add-PnPField @args | Out-Null

    # Uniqueness requires the column to be indexed first; SharePoint refuses otherwise.
    if ($Field.Unique) {
        Set-PnPField -List $ListTitle -Identity $name -Values @{ Indexed = $true } | Out-Null
        Set-PnPField -List $ListTitle -Identity $name -Values @{ EnforceUniqueValues = $true } | Out-Null
        Write-Host "    + $name  (unique)" -ForegroundColor Green
    }
    else {
        Write-Host "    + $name" -ForegroundColor Green
    }
    $script:Created++
}

# ── run ──────────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "NITDA DGO — SharePoint provisioning" -ForegroundColor Cyan
Write-Host "Site: $SiteUrl"
Write-Host ""

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "PnP.PowerShell is not installed. Run this first, then re-run this script:" -ForegroundColor Red
    Write-Host "    Install-Module PnP.PowerShell -Scope CurrentUser"
    exit 1
}

Write-Host "Signing in — a browser window will open." -ForegroundColor Yellow
Connect-PnPOnline -Url $SiteUrl -Interactive

Write-Host ""
Write-Host "Correspondence" -ForegroundColor Cyan
Ensure-List -Title 'Correspondence' -Template GenericList
foreach ($f in $CorrespondenceFields) { Ensure-Field -ListTitle 'Correspondence' -Field $f }

Write-Host ""
Write-Host "SupportCases" -ForegroundColor Cyan
Ensure-List -Title 'SupportCases' -Template GenericList
foreach ($f in $SupportCaseFields) { Ensure-Field -ListTitle 'SupportCases' -Field $f }

Write-Host ""
Write-Host "CorrespondenceDocuments" -ForegroundColor Cyan
Ensure-List -Title 'CorrespondenceDocuments' -Template DocumentLibrary
foreach ($f in $DocumentFields) { Ensure-Field -ListTitle 'CorrespondenceDocuments' -Field $f }

Write-Host ""
Write-Host "Done. $script:Created column(s) created, $script:Skipped already present." -ForegroundColor Green
Write-Host ""
Write-Host "Record this as V8 in your values file:" -ForegroundColor Yellow
Write-Host "    $SiteUrl"
Write-Host ""

Disconnect-PnPOnline
