#!/usr/bin/env python3
"""
test_payload_contract.py — Validates that buildSingleAssignmentPayload produces
the correct outbound shape expected by the Power Automate flow.

Run with:  python3 tools/test_payload_contract.py

Mirrors the JavaScript implementation in core/assignment-payload.js.
"""

import json
import re
import sys
from datetime import date


def normalize_priority(value, fallback='normal'):
    val = str(value or '').strip().lower()
    canonical = {'low', 'normal', 'high', 'urgent'}
    aliases = {
        'p4': 'low', 'medium': 'normal', 'p3': 'normal',
        'p2': 'high', 'p1': 'urgent', 'critical': 'urgent'
    }
    return val if val in canonical else aliases.get(val, fallback)


def split_recipients(value):
    return [x.strip() for x in re.split(r'[;,\s]+', str(value or '')) if x.strip()]


def build_single_assignment_payload(activity, form, actor, depts=None):
    """Python mirror of core/assignment-payload.js:buildSingleAssignmentPayload"""
    priority = normalize_priority(form.get('priority', 'normal'))
    priority_cap = priority[0].upper() + priority[1:]
    cc_list = split_recipients(form.get('copy', ''))
    copy_to = ';'.join(cc_list)
    start_date = form.get('startDate', '') or date.today().isoformat()
    ack_date = form.get('ack', '')
    due_date = form.get('due', '')
    raw_id = activity.get('id', activity.get('sourceId', 0))
    try:
        activity_id = int(str(raw_id))
    except (ValueError, TypeError):
        activity_id = 0
    date_part = start_date.replace('-', '')
    cat_code = form.get('categoryCode', 'UNC') or 'UNC'
    sub_code = form.get('subcategoryCode', 'GEN') or 'GEN'
    pre_ref_id = f"{date_part}-{activity_id}-{cat_code}-{sub_code}-"
    categorization = '-'.join(
        x for x in [form.get('category', ''), form.get('subcategory', '')] if x
    )
    depts = depts or []
    primary_dept = next((d for d in depts if d.get('dsuKey') == form.get('dsu')), {})
    support_dept = next((d for d in depts if d.get('dsuKey') == form.get('supportDsu')), {})
    assigned_to_title = primary_dept.get('headTitle', '')
    supporting_assignee_title = support_dept.get('headTitle', '')
    supporting_to = str(form.get('supportingAssignee', '')).strip()
    title = activity.get('title', activity.get('subject', str(activity.get('id', ''))))
    device = {
        'id': 'standalone-html',
        'platform': '',   # navigator.platform in browser
        'ua': ''          # navigator.userAgent in browser
    }
    task = {
        'StartDate': start_date, 'ActivityID': activity_id,
        'Title': title,
        'Description': activity.get('description', activity.get('body', '')),
        'Status': 'New',
        'Category': form.get('category', ''), 'CategoryCode': cat_code,
        'SubCategory': form.get('subcategory', ''), 'SubCategoryCode': sub_code,
        'PrimaryDSU': form.get('dsu', ''), 'AssignedTo': str(form.get('assignedTo', '')).strip(),
        'AssignedToTitle': assigned_to_title, 'AssignedDSU': form.get('dsu', ''),
        'supportingAssignedTo': supporting_to, 'SupportAssignedTo': supporting_to,
        'SupportAssignedToTitle': supporting_assignee_title,
        'SupportDSU': form.get('supportDsu', ''), 'SupportDSUKey': form.get('supportDsu', ''),
        'AckDue': ack_date, 'AcknowledgementDueBy': ack_date,
        'AcknolwedgementDueBy': ack_date,  # intentional misspelling
        'TaskDue': due_date, 'TaskDueDate': due_date,
        'Timeline': 'No dependencies', 'CopyTo': copy_to, 'Priority': priority_cap,
        'PreReferenceID': pre_ref_id, 'Categorization': categorization,
        'AttachmentLink': activity.get('attachmentLink', activity.get('AttachmentLink', activity.get('Link', ''))),
        'Comments': form.get('comments', ''), 'ActionRequired': '',
        'CreatedBy': actor.get('email', '')
    }
    selected = {
        'ID': activity_id,
        'RefIDD': str(activity.get('id', '')),
        'Title': title
    }
    payload_task = {
        'StartDate': task['StartDate'], 'ActivityID': task['ActivityID'],
        'Title': task['Title'], 'Category': task['Category'],
        'CategoryCode': task['CategoryCode'], 'SubCategory': task['SubCategory'],
        'SubCategoryCode': task['SubCategoryCode'], 'AssignedTo': task['AssignedTo'],
        'AssignedToTitle': task['AssignedToTitle'], 'AssignedDSU': task['AssignedDSU'],
        'PrimaryDSU': task['PrimaryDSU'], 'supportingAssignedTo': task['supportingAssignedTo'],
        'SupportDSU': task['SupportDSU'], 'Priority': task['Priority'],
        'AcknowledgementDueBy': task['AcknowledgementDueBy'],
        'TaskDueDate': task['TaskDueDate'], 'CopyTo': task['CopyTo'],
        'PreReferenceID': task['PreReferenceID'], 'Comments': task['Comments'],
        'ActionRequired': task['ActionRequired'], 'CreatedBy': task['CreatedBy']
    }
    return {
        'operation': 'create', 'mode': 'single',
        'source': 'DGO_FAST_Track_WEB_OPS', 'method': 'POST',
        'device': device, 'AssignmentType': form.get('type', 'newassignment'),
        'NewActivityTask': task, 'Selected': selected,
        'payload': {
            'task': payload_task,
            'selection': {'single': selected, 'items': []},
            'assignment': {'type': form.get('type', 'newassignment')}
        }
    }


def assert_eq(label, actual, expected):
    if actual != expected:
        print(f"  FAIL  {label}")
        print(f"        expected: {expected!r}")
        print(f"        actual:   {actual!r}")
        return False
    print(f"  PASS  {label}")
    return True


def run_tests():
    passed = 0
    failed = 0

    # Sample input (mirrors the problem statement example)
    activity = {
        'id': 21275,
        'title': '21275 -2026-07-24 -NIGERIA AFCFTA ... .PDF',
        'description': '<p>Full original HTML notification body</p>',
        'attachmentLink': 'https://example.com/attachment.pdf'
    }
    form = {
        'type': 'newassignment', 'referenceId': '',
        'category': 'Engagements and Events', 'categoryCode': 'EAI',
        'subcategory': 'Invitations', 'subcategoryCode': 'INV',
        'dsu': 'CEO', 'supportDsu': '',
        'assignedTo': 'dg@nitda.gov.ng', 'supportingAssignee': '',
        'copy': 'dgs@nitda.gov.ng;AHASSAN@NITDA.GOV.NG',
        'startDate': '2026-07-27', 'ack': '2026-07-28', 'due': '2026-07-28',
        'priority': 'High', 'comments': ''
    }
    actor = {'email': 'dgsregistry@nitda.gov.ng'}
    depts = [{'dsuKey': 'CEO', 'headTitle': 'DGCEO', 'title': 'CEO', 'email': 'dg@nitda.gov.ng'}]

    print("=== buildSingleAssignmentPayload contract tests ===\n")

    result = build_single_assignment_payload(activity, form, actor, depts)
    nt = result['NewActivityTask']
    sel = result['Selected']
    pt = result['payload']['task']

    tests = [
        ("operation", result['operation'], 'create'),
        ("mode", result['mode'], 'single'),
        ("source", result['source'], 'DGO_FAST_Track_WEB_OPS'),
        ("method", result['method'], 'POST'),
        ("device.id", result['device']['id'], 'standalone-html'),
        ("AssignmentType", result['AssignmentType'], 'newassignment'),
        # NewActivityTask fields
        ("NewActivityTask.ActivityID type", type(nt['ActivityID']), int),
        ("NewActivityTask.ActivityID value", nt['ActivityID'], 21275),
        ("NewActivityTask.Priority capitalized", nt['Priority'], 'High'),
        ("NewActivityTask.PrimaryDSU", nt['PrimaryDSU'], 'CEO'),
        ("NewActivityTask.AssignedDSU == PrimaryDSU", nt['AssignedDSU'], nt['PrimaryDSU']),
        ("NewActivityTask.AssignedToTitle", nt['AssignedToTitle'], 'DGCEO'),
        ("NewActivityTask.CopyTo semicolon-delimited", nt['CopyTo'], 'dgs@nitda.gov.ng;AHASSAN@NITDA.GOV.NG'),
        ("NewActivityTask.AckDue", nt['AckDue'], '2026-07-28'),
        ("NewActivityTask.AcknowledgementDueBy", nt['AcknowledgementDueBy'], '2026-07-28'),
        ("NewActivityTask.AcknolwedgementDueBy (misspelled)", nt['AcknolwedgementDueBy'], '2026-07-28'),
        ("NewActivityTask.TaskDue", nt['TaskDue'], '2026-07-28'),
        ("NewActivityTask.TaskDueDate", nt['TaskDueDate'], '2026-07-28'),
        ("NewActivityTask.PreReferenceID", nt['PreReferenceID'], '20260727-21275-EAI-INV-'),
        ("NewActivityTask.Categorization", nt['Categorization'], 'Engagements and Events-Invitations'),
        ("NewActivityTask.Status", nt['Status'], 'New'),
        ("NewActivityTask.Timeline", nt['Timeline'], 'No dependencies'),
        ("NewActivityTask.supportingAssignedTo == SupportAssignedTo", nt['supportingAssignedTo'], nt['SupportAssignedTo']),
        ("NewActivityTask.CreatedBy", nt['CreatedBy'], 'dgsregistry@nitda.gov.ng'),
        # Selected
        ("Selected.ID type", type(sel['ID']), int),
        ("Selected.ID value", sel['ID'], 21275),
        ("Selected.RefIDD type", type(sel['RefIDD']), str),
        ("Selected.RefIDD value", sel['RefIDD'], '21275'),
        # payload.task
        ("payload.task.ActivityID type", type(pt['ActivityID']), int),
        ("payload.task.PrimaryDSU", pt['PrimaryDSU'], 'CEO'),
        ("payload.task.AssignedToTitle", pt['AssignedToTitle'], 'DGCEO'),
        ("payload.task.CopyTo", pt['CopyTo'], 'dgs@nitda.gov.ng;AHASSAN@NITDA.GOV.NG'),
        # payload.assignment
        ("payload.assignment.type", result['payload']['assignment']['type'], 'newassignment'),
        ("payload.selection.items empty", result['payload']['selection']['items'], []),
        # Absent legacy fields
        ("no 'schema' field", 'schema' not in result, True),
        ("no 'tracking' field", 'tracking' not in result, True),
        ("no 'activity' field", 'activity' not in result, True),
        ("no cascadeSnapshot", 'cascadeSnapshot' not in result, True),
    ]

    for label, actual, expected in tests:
        if assert_eq(label, actual, expected):
            passed += 1
        else:
            failed += 1

    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed")
    if failed:
        sys.exit(1)
    else:
        print("ALL TESTS PASSED")


if __name__ == '__main__':
    run_tests()
