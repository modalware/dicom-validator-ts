# Test DCM Fixtures

Generated synthetic DICOM files for validation testing.

| File | Rule | Severity | Description |
|------|------|----------|-------------|
| vr/vr-format-AE.dcm | vr-format-AE | error | AE value exceeds maximum 16 characters |
| vr/vr-format-AS.dcm | vr-format-AS | error | AS value does not match NNN[DWMY] format |
| vr/vr-format-CS.dcm | vr-format-CS | error | CS value contains invalid characters or exceeds 16 characters |
| vr/vr-format-DA.dcm | vr-format-DA | error | DA value does not match YYYYMMDD format |
| vr/vr-format-DS.dcm | vr-format-DS | error | DS value is not a valid decimal string |
| vr/vr-format-IS.dcm | vr-format-IS | error | IS value is not a valid integer string |
| vr/vr-format-LO.dcm | vr-format-LO | error | LO value exceeds maximum 64 characters |
| vr/vr-format-LT.dcm | vr-format-LT | error | LT value exceeds maximum 10240 characters |
| vr/vr-format-PN.dcm | vr-format-PN | error | PN component group exceeds maximum 64 characters |
| vr/vr-format-SH.dcm | vr-format-SH | error | SH value exceeds maximum 16 characters |
| vr/vr-format-ST.dcm | vr-format-ST | error | ST value exceeds maximum 1024 characters |
| vr/vr-format-TM.dcm | vr-format-TM | error | TM value does not match valid time format |
| vr/vr-format-UI.dcm | vr-format-UI | error | UI value contains invalid characters |
| vr/vr-format-UR.dcm | vr-format-UR | error | UR value contains trailing spaces |
| vr/vr-format-UT.dcm | vr-format-UT | error | UT value exceeds maximum length |
| vm/vm-constraint-too-many.dcm | vm-constraint | error | Tag value has too many values exceeding maximum VM |
| vm/vm-constraint-too-few.dcm | vm-constraint | error | Tag value has too few values below minimum VM |
| module/type1-missing.dcm | type1-missing | error | Type 1 attribute (Modality) is missing from the dataset |
| module/type1-empty.dcm | type1-empty | error | Type 1 attribute (Modality) has a zero-length value |
| module/type2-missing.dcm | type2-missing | warning | Type 2 attribute (Referring Physician Name) is missing from the dataset |
| module/type1-missing-manufacturer.dcm | type1-missing | error | Type 1 attribute (Manufacturer) is missing from the General Equipment module |
| module/type1-missing-pixel-rows.dcm | type1-missing | error | Type 1 attribute (Rows) is missing from the Image Pixel module |
| module/type2-missing-content-date.dcm | type2-missing | warning | Type 2 attribute (Content Date) is missing from the General Image module |
| module/type1-missing-pixel-spacing.dcm | type1-missing | error | Type 1 attribute (Pixel Spacing) is missing from the Image Plane module |
| module/type1-missing-frame-of-ref-uid.dcm | type1-missing | error | Type 1 attribute (Frame of Reference UID) is missing from the Frame of Reference module |
| iod/iod-sop-class-missing.dcm | iod-sop-class-missing | error | SOP Class UID tag is entirely absent from the dataset |
| iod/iod-sop-class-unknown.dcm | iod-sop-class-unknown | error | SOP Class UID is set to an unrecognized value (9.9.9.9.9) |
| tag/vr-unknown.dcm | vr-unknown | warning | Tag has a VR that is not registered in the validator |
| tag/vr-undetermined.dcm | vr-undetermined | warning | Tag VR cannot be determined from element or dictionary |
