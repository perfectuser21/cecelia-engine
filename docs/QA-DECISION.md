# QA Decision

Decision: NO_RCI
Priority: P3
RepoType: Engine

## Tests

- dod_item: "P0 结束"
  method: manual
  location: manual:session-end

- dod_item: "P1 轮询"
  method: manual
  location: manual:polling-loop

## RCI

new: []
update: []

## Reason

两阶段分离测试，P3 优先级。
