<#
.SYNOPSIS
    Provisions the DGO_* platform lists from the authoritative specification, and reports
    what your existing operational lists already have.

.DESCRIPTION
    THIS SCRIPT NO LONGER INVENTS A SCHEMA.

    An earlier version of this script created a `Correspondence` list with columns of its own
    devising. That was wrong twice over. The platform already reads a set of operational
    lists that exist in your tenant — the code normalises `RefIDD`, `Reference_ID`,
    `RoutedToDSU`, `DSU_KEY`, `CC_x0027_dTo` and `_x0033_rdAssigned`, which are SharePoint
    internal names for real columns nobody would invent. And a complete provisioning
    specification for the ten DGO_* platform lists already existed, with 97 fields and their
    SchemaXml. Creating a third, parallel schema would have left the platform reading one set
    of lists while the intake channel wrote to another.

    So this script does two different things, and neither creates anything you already have:

      PROVISION  the ten DGO_* platform lists, driven entirely by
                 docs/reference/sharepoint-provisioning-spec.json. Nothing is hardcoded here;
                 change the specification, not this file.

      REPORT     your existing operational lists — which columns the platform reads, which
                 are present, and which are missing. It does NOT alter them. Those lists hold
                 live correspondence, and a script that adds columns to a system of record
                 without a human reading the diff first is not a script anyone should run.

.PARAMETER SiteUrl
    The full SharePoint site URL.

.PARAMETER WhatIf
    Report every action without making any change. Run this first.

.PARAMETER OperationalListsOnly
    Skip provisioning; only report on the existing operational lists.

.EXAMPLE
    ./setup-sharepoint.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/DGO" -WhatIf
    ./setup-sharepoint.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/DGO"

.NOTES
    Requires PnP.PowerShell:  Install-Module PnP.PowerShell -Scope CurrentUser
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,

    [switch]$OperationalListsOnly
)

$ErrorActionPreference = 'Stop'

$SpecPath = Join-Path $PSScriptRoot '../docs/reference/sharepoint-provisioning-spec.json'
$RoleSeedPath = Join-Path $PSScriptRoot '../docs/reference/role-catalogue-seed.json'

<#
  The columns the PLATFORM READS from your existing operational lists.

  Taken from core/domain.js — normalizeDocument, normalizeTask, normalizeComment,
  normalizeCategory and normalizeDepartment. These are read paths: if a column is missing the
  platform shows a blank, it does not fail. Which is exactly why a missing one goes unnoticed
  for months, and why this report exists.

  `Alternatives` are columns the normaliser accepts interchangeably — it reads whichever is
  present, so having any ONE of them is sufficient.
#>
$OperationalSchema = @(
    @{
        Purpose = 'Correspondence / activities'
        Aliases = @('Activities', 'Correspondence', 'Documents', 'Records')
        Columns = @(
            @{ Name = 'Title';            Reads = 'the subject line' }
            @{ Name = 'RefIDD';           Reads = 'the registry reference'; Alternatives = @('Reference_ID') }
            @{ Name = 'Description';      Reads = 'the body' }
            @{ Name = 'Category';         Reads = 'routing category' }
            @{ Name = 'AssignmentStatus'; Reads = 'whether it is assigned' }
            @{ Name = 'AssignedTo';       Reads = 'the officer'; Alternatives = @('Assigned') }
            @{ Name = 'RoutedToDSU';      Reads = 'the receiving directorate' }
            @{ Name = 'AttachmentLink';   Reads = 'the document in the library' }
            @{ Name = "CC_x0027_dTo";     Reads = 'copy recipients' }
        )
    },
    @{
        Purpose = 'Tasks / tracking'
        Aliases = @('Tasks', 'Tracking')
        Columns = @(
            @{ Name = 'Title';               Reads = 'the task title' }
            @{ Name = 'RefIDD';              Reads = 'the reference it belongs to'; Alternatives = @('Reference_ID') }
            @{ Name = 'AssignedTo';          Reads = 'the officer'; Alternatives = @('Assigned') }
            @{ Name = 'AssignedToDSU';       Reads = 'the owning directorate'; Alternatives = @('DSULookUp') }
            @{ Name = 'CoAssigneeDSU';       Reads = 'the supporting directorate' }
            @{ Name = '_x0033_rdAssigned';   Reads = 'the third assignee' }
            @{ Name = 'RoutedToDSU';         Reads = 'routing' }
            @{ Name = 'Classification';      Reads = 'confidentiality' }
            @{ Name = 'Priority';            Reads = 'priority' }
            @{ Name = 'Progress';            Reads = 'progress'; Alternatives = @('Status') }
            @{ Name = 'StartDate';           Reads = 'when work began' }
            @{ Name = 'DueDate';             Reads = 'the deadline' }
            @{ Name = 'AcknowledgementDue';  Reads = 'the acknowledgement deadline' }
        )
    },
    @{
        Purpose = 'Comments / minutes'
        Aliases = @('Comments', 'TaskComments')
        Columns = @(
            @{ Name = 'Title';       Reads = 'the reference or title' }
            @{ Name = 'RefIDD';      Reads = 'the reference'; Alternatives = @('Reference_ID') }
            @{ Name = 'Description'; Reads = 'the minute text' }
            @{ Name = 'AuthorTitle'; Reads = 'who wrote it' }
            @{ Name = 'EditorEmail'; Reads = 'their address' }
        )
    },
    @{
        Purpose = 'Category routing matrix'
        Aliases = @('Categories', 'CategoryMatrix')
        Columns = @(
            @{ Name = 'Category';    Reads = 'the category' }
            @{ Name = 'Subcategory'; Reads = 'the subcategory' }
            @{ Name = 'DSU_KEY';     Reads = 'which directorate it routes to' }
            @{ Name = 'Priority';    Reads = 'default priority' }
            @{ Name = 'Timeline';    Reads = 'default turnaround' }
        )
    },
    @{
        Purpose = 'Directorate directory'
        Aliases = @('Departments', 'DepartmentDirectory', 'DSU')
        Columns = @(
            @{ Name = 'Title';                  Reads = 'the directorate name' }
            @{ Name = 'DSU_KEY';                Reads = 'its routing key' }
            @{ Name = 'DSU_Email';              Reads = 'its shared mailbox' }
            @{ Name = 'DSU_HeadEmail';          Reads = 'the head of directorate' }
            @{ Name = 'DSU_HeadPersonalEmail';  Reads = 'their personal address' }
            @{ Name = 'DSU_HeadTitle';          Reads = 'their title' }
        )
    }
)

# ── helpers ──────────────────────────────────────────────────────────────────────────────

$script:Created = 0; $script:Present = 0; $script:Failed = 0

function Get-ListSafe([string]$Title) {
    return Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
}

function Get-FieldNames([string]$ListTitle) {
    try { return (Get-PnPField -List $ListTitle -ErrorAction Stop | Select-Object -ExpandProperty InternalName) }
    catch { return @() }
}

function Ensure-SpecList($ListSpec, $FieldsForList) {
    $title = $ListSpec.ListTitle

    if (Get-ListSafe $title) {
        Write-Host "  = $title (exists)" -ForegroundColor DarkGray
    }
    elseif ($PSCmdlet.ShouldProcess($title, 'Create list')) {
        New-PnPList -Title $title -Template GenericList -OnQuickLaunch | Out-Null
        if ($ListSpec.Description) { Set-PnPList -Identity $title -Description $ListSpec.Description | Out-Null }
        Write-Host "  + $title" -ForegroundColor Green
    }
    else {
        Write-Host "  ? $title (would create)" -ForegroundColor Yellow
        return
    }

    $existing = Get-FieldNames $title

    foreach ($f in ($FieldsForList | Sort-Object FieldOrderInList)) {
        $name = $f.InternalName

        if ($existing -contains $name) { Write-Host "      = $name" -ForegroundColor DarkGray; $script:Present++; continue }

        if (-not $PSCmdlet.ShouldProcess("$title.$name", 'Add field')) {
            Write-Host "      ? $name ($($f.FieldType))" -ForegroundColor Yellow
            continue
        }

        try {
            # SchemaXml from the specification is used verbatim where present. It carries the
            # exact type, Required flag and choice values that were signed off — rebuilding
            # them from the other columns would be a second source of truth for the same fact.
            if ($f.SchemaXml) {
                Add-PnPFieldFromXml -List $title -FieldXml $f.SchemaXml | Out-Null
            }
            else {
                $args = @{ List = $title; DisplayName = $f.DisplayName; InternalName = $name
                           Type = $f.FieldType; AddToDefaultView = $true }
                if ($f.ChoiceValues) { $args['Choices'] = @($f.ChoiceValues -split '\s*[;|]\s*' | Where-Object { $_ }) }
                Add-PnPField @args | Out-Null
            }

            if ("$($f.Indexed)" -eq 'Yes') {
                Set-PnPField -List $title -Identity $name -Values @{ Indexed = $true } | Out-Null
            }
            Write-Host "      + $name ($($f.FieldType))" -ForegroundColor Green
            $script:Created++
        }
        catch {
            Write-Host "      ! $name — $($_.Exception.Message)" -ForegroundColor Red
            $script:Failed++
        }
    }
}

function Ensure-SeedItem($Seed, $RoleRows) {
    $title = $Seed.ListTitle
    $keyField = $Seed.KeyField
    $keyValue = $Seed.KeyValue

    if (-not (Get-ListSafe $title)) {
        Write-Host "      ? $title.$keyValue — list absent, seed skipped" -ForegroundColor Yellow
        return
    }

    # Idempotent by the specification's own key field, not by Title. Re-running must never
    # produce a second systemAdmin row, and several of these lists have a Title that is not
    # unique by design.
    # @() wraps the result: a CAML query matching exactly one item returns a bare object,
    # not an array, and a bare object has no .Count — the seed would then be treated as
    # absent and created a second time on every run.
    $existing = @()
    try {
        $existing = @(Get-PnPListItem -List $title -Query `
            "<View><Query><Where><Eq><FieldRef Name='$keyField'/><Value Type='Text'>$keyValue</Value></Eq></Where></Query></View>" `
            -ErrorAction Stop)
    } catch { $existing = @() }

    if ($existing.Count -gt 0) {
        Write-Host "      = $keyValue" -ForegroundColor DarkGray
        $script:Present++
        return
    }

    # DGO_RoleCatalogue is seeded from role-catalogue-seed.json, NOT from the workbook.
    # The workbook was extracted before decision D6(b) and before scan-intake, so its role
    # rows grant executive, director and operator fewer routes than config/rbac.config.js
    # actually allows. Seeding those would take pages away from officers who use them daily.
    # Every other list seeds from the specification verbatim.
    $values = $null
    if ($title -eq 'DGO_RoleCatalogue' -and $RoleRows) {
        $row = $RoleRows | Where-Object { $_.RoleId -eq $keyValue } | Select-Object -First 1
        if ($row) {
            $values = @{}
            $row.PSObject.Properties | ForEach-Object { $values[$_.Name] = $_.Value }
        }
    }
    if (-not $values) {
        if (-not $Seed.FieldsJson) {
            Write-Host "      ! $keyValue — no FieldsJson in the specification" -ForegroundColor Red
            $script:Failed++
            return
        }
        $values = @{}
        ($Seed.FieldsJson | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $values[$_.Name] = $_.Value }
    }

    if (-not $PSCmdlet.ShouldProcess("$title.$keyValue", 'Create seed item')) {
        Write-Host "      ? $keyValue (would create)" -ForegroundColor Yellow
        return
    }

    try {
        Add-PnPListItem -List $title -Values $values | Out-Null
        Write-Host "      + $keyValue" -ForegroundColor Green
        $script:Created++
    }
    catch {
        Write-Host "      ! $keyValue — $($_.Exception.Message)" -ForegroundColor Red
        $script:Failed++
    }
}

function Report-OperationalList($Group) {
    $found = $null
    foreach ($alias in $Group.Aliases) { if (Get-ListSafe $alias) { $found = $alias; break } }

    if (-not $found) {
        Write-Host "  ? $($Group.Purpose)" -ForegroundColor Yellow
        Write-Host "      no list found named: $($Group.Aliases -join ', ')" -ForegroundColor DarkGray
        Write-Host "      if yours is named differently, that is fine — check it by hand" -ForegroundColor DarkGray
        return
    }

    Write-Host "  · $($Group.Purpose) -> '$found'" -ForegroundColor Cyan
    $existing = Get-FieldNames $found
    $missing = @()

    foreach ($c in $Group.Columns) {
        $names = @($c.Name) + @($c.Alternatives | Where-Object { $_ })
        $hit = $names | Where-Object { $existing -contains $_ } | Select-Object -First 1
        if ($hit) { Write-Host "      ok  $hit" -ForegroundColor DarkGray }
        else { Write-Host "      --  $($c.Name)  (platform reads: $($c.Reads))" -ForegroundColor Yellow
               $missing += $c.Name }
    }

    if ($missing.Count -gt 0) {
        Write-Host "      $($missing.Count) column(s) the platform reads are absent." -ForegroundColor Yellow
        Write-Host "      Not added automatically — this list holds live records." -ForegroundColor Yellow
    }
}

# ── run ──────────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "NITDA DGO — SharePoint" -ForegroundColor Cyan
Write-Host "Site: $SiteUrl"
if ($WhatIfPreference) { Write-Host "WHATIF — reporting only, nothing will be changed" -ForegroundColor Yellow }
Write-Host ""

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "PnP.PowerShell is not installed. Run this, then try again:" -ForegroundColor Red
    Write-Host "    Install-Module PnP.PowerShell -Scope CurrentUser"
    exit 1
}

Connect-PnPOnline -Url $SiteUrl -Interactive

if (-not $OperationalListsOnly) {
    if (-not (Test-Path $SpecPath)) {
        Write-Host "Specification not found at $SpecPath" -ForegroundColor Red
        exit 1
    }
    $spec = Get-Content $SpecPath -Raw | ConvertFrom-Json

    Write-Host "Platform lists — from $(Split-Path $SpecPath -Leaf)" -ForegroundColor Cyan
    Write-Host "$($spec.lists.Count) list(s), $($spec.fields.Count) field(s) specified"

    # -SiteUrl decides where these land; the specification's TargetSite is documentation.
    # They are reported when they disagree because two copies of this workbook exist with
    # different TargetSite values (DGO_ECM_GOVERNANCE and NITDADGO-EAAACTIVITYTRACKING),
    # and provisioning the governance lists into the wrong site is the kind of mistake that
    # is only noticed once something reads an empty directory and fails open.
    $specSites = @($spec.lists | ForEach-Object { $_.TargetSite } | Where-Object { $_ } | Sort-Object -Unique)
    foreach ($site in $specSites) {
        if ($site.TrimEnd('/') -ne $SiteUrl.TrimEnd('/')) {
            Write-Host ""
            Write-Host "  ! The specification names a different site:" -ForegroundColor Yellow
            Write-Host "      specification : $site" -ForegroundColor Yellow
            Write-Host "      -SiteUrl      : $SiteUrl" -ForegroundColor Yellow
            Write-Host "    -SiteUrl wins. Confirm this is the site you intend before continuing." -ForegroundColor Yellow
        }
    }
    Write-Host ""

    foreach ($l in ($spec.lists | Sort-Object ListOrder)) {
        $fieldsForList = $spec.fields | Where-Object { $_.ListTitle -eq $l.ListTitle }
        Ensure-SpecList -ListSpec $l -FieldsForList $fieldsForList
    }
    Write-Host ""

    # Seed items. Previously specified and never provisioned: the ten seed rows — six of
    # them the RBAC role catalogue — were read out of the workbook into the specification
    # and then nothing created them, so DGO_RoleCatalogue provisioned empty every time.
    if ($spec.seedItems) {
        $roleRows = $null
        if (Test-Path $RoleSeedPath) {
            $roleRows = (Get-Content $RoleSeedPath -Raw | ConvertFrom-Json).rows
            Write-Host "Seed items — roles from $(Split-Path $RoleSeedPath -Leaf), the rest from the specification" -ForegroundColor Cyan
        }
        else {
            Write-Host "Seed items — from the specification" -ForegroundColor Cyan
            Write-Host "  ! role-catalogue-seed.json is absent; DGO_RoleCatalogue will be seeded from the" -ForegroundColor Yellow
            Write-Host "    workbook, whose role rows predate D6(b) and scan-intake. Run: npm run seed:roles" -ForegroundColor Yellow
        }
        Write-Host "$($spec.seedItems.Count) seed item(s) specified"
        Write-Host ""

        foreach ($group in ($spec.seedItems | Group-Object ListTitle | Sort-Object Name)) {
            Write-Host "  · $($group.Name)" -ForegroundColor Cyan
            foreach ($s in $group.Group) { Ensure-SeedItem -Seed $s -RoleRows $roleRows }
        }
        Write-Host ""
    }
}

Write-Host "Existing operational lists — REPORT ONLY, nothing is changed" -ForegroundColor Cyan
Write-Host "These already hold your correspondence. The platform reads the columns below."
Write-Host ""
foreach ($g in $OperationalSchema) { Report-OperationalList -Group $g }

Write-Host ""
Write-Host "Platform lists: $script:Created created, $script:Present already present, $script:Failed failed (fields and seed items)." -ForegroundColor Green
Write-Host ""
Write-Host "Anything marked -- above is a column the platform reads and your list does not have." -ForegroundColor Yellow
Write-Host "Decide each one deliberately. Adding a column to a live register is a change to a" -ForegroundColor Yellow
Write-Host "system of record, which is why this script will not do it for you." -ForegroundColor Yellow
Write-Host ""

Disconnect-PnPOnline
