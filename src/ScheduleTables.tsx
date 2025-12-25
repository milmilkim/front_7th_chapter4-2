import { Button, ButtonGroup, Flex, Heading, Stack } from "@chakra-ui/react";
import ScheduleTable from "./ScheduleTable.tsx";
import { useScheduleContext } from "./ScheduleContext.tsx";
import SearchDialog from "./SearchDialog.tsx";
import { memo, useCallback, useMemo, useState } from "react";
import { Schedule } from "./types.ts";
import { DndContext, Modifier, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CellSize, DAY_LABELS } from "./constants.ts";

function createSnapModifier(): Modifier {
  return ({ transform, containerNodeRect, draggingNodeRect }) => {
    const containerTop = containerNodeRect?.top ?? 0;
    const containerLeft = containerNodeRect?.left ?? 0;
    const containerBottom = containerNodeRect?.bottom ?? 0;
    const containerRight = containerNodeRect?.right ?? 0;

    const { top = 0, left = 0, bottom = 0, right = 0 } = draggingNodeRect ?? {};

    const minX = containerLeft - left + 120 + 1;
    const minY = containerTop - top + 40 + 1;
    const maxX = containerRight - right;
    const maxY = containerBottom - bottom;

    return {
      ...transform,
      x: Math.min(
        Math.max(
          Math.round(transform.x / CellSize.WIDTH) * CellSize.WIDTH,
          minX
        ),
        maxX
      ),
      y: Math.min(
        Math.max(
          Math.round(transform.y / CellSize.HEIGHT) * CellSize.HEIGHT,
          minY
        ),
        maxY
      ),
    };
  };
}

const modifiers = [createSnapModifier()];

const ScheduleTableItem = memo(
  ({
    tableId,
    schedules,
    index,
    disabledRemoveButton,
    onOpenSearch,
    onDuplicate,
    onRemove,
    onScheduleTimeClick,
    onDeleteSchedule,
    onDragEnd,
  }: {
    tableId: string;
    schedules: Schedule[];
    index: number;
    disabledRemoveButton: boolean;
    onOpenSearch: (tableId: string) => void;
    onDuplicate: (tableId: string) => void;
    onRemove: (tableId: string) => void;
    onScheduleTimeClick: (
      tableId: string,
      timeInfo: { day: string; time: number }
    ) => void;
    onDeleteSchedule: (tableId: string, day: string, time: number) => void;
    onDragEnd: (tableId: string, event: any) => void;
  }) => {
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 8,
        },
      })
    );

    const handleDragEnd = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event: any) => {
        onDragEnd(tableId, event);
      },
      [tableId, onDragEnd]
    );

    const handleOpenSearch = useCallback(() => {
      onOpenSearch(tableId);
    }, [tableId, onOpenSearch]);

    const handleDuplicate = useCallback(() => {
      onDuplicate(tableId);
    }, [tableId, onDuplicate]);

    const handleRemove = useCallback(() => {
      onRemove(tableId);
    }, [tableId, onRemove]);

    const handleScheduleTimeClick = useCallback(
      (timeInfo: { day: string; time: number }) => {
        onScheduleTimeClick(tableId, timeInfo);
      },
      [tableId, onScheduleTimeClick]
    );

    const handleDeleteButtonClick = useCallback(
      ({ day, time }: { day: string; time: number }) => {
        onDeleteSchedule(tableId, day, time);
      },
      [tableId, onDeleteSchedule]
    );

    return (
      <Stack width="600px">
        <Flex justifyContent="space-between" alignItems="center">
          <Heading as="h3" fontSize="lg">
            시간표 {index + 1}
          </Heading>
          <ButtonGroup size="sm" isAttached>
            <Button colorScheme="green" onClick={handleOpenSearch}>
              시간표 추가
            </Button>
            <Button colorScheme="green" mx="1px" onClick={handleDuplicate}>
              복제
            </Button>
            <Button
              colorScheme="green"
              isDisabled={disabledRemoveButton}
              onClick={handleRemove}
            >
              삭제
            </Button>
          </ButtonGroup>
        </Flex>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd} modifiers={modifiers}>
          <ScheduleTable
            schedules={schedules}
            tableId={tableId}
            onScheduleTimeClick={handleScheduleTimeClick}
            onDeleteButtonClick={handleDeleteButtonClick}
          />
        </DndContext>
      </Stack>
    );
  }
);

export const ScheduleTables = () => {
  const { schedulesMap, setSchedulesMap } = useScheduleContext();
  const [searchInfo, setSearchInfo] = useState<{
    tableId: string;
    day?: string;
    time?: number;
  } | null>(null);

  const disabledRemoveButton = useMemo(
    () => Object.keys(schedulesMap).length === 1,
    [schedulesMap]
  );

  const duplicate = useCallback(
    (targetId: string) => {
      setSchedulesMap((prev) => ({
        ...prev,
        [`schedule-${Date.now()}`]: [...prev[targetId]],
      }));
    },
    [setSchedulesMap]
  );

  const remove = useCallback(
    (targetId: string) => {
      setSchedulesMap((prev) => {
        delete prev[targetId];
        return { ...prev };
      });
    },
    [setSchedulesMap]
  );

  const handleOpenSearch = useCallback((tableId: string) => {
    setSearchInfo({ tableId });
  }, []);

  const handleScheduleTimeClick = useCallback(
    (tableId: string, timeInfo: { day: string; time: number }) => {
      setSearchInfo({ tableId, ...timeInfo });
    },
    []
  );

  const handleDeleteSchedule = useCallback(
    (tableId: string, day: string, time: number) => {
      setSchedulesMap((prev) => ({
        ...prev,
        [tableId]: prev[tableId].filter(
          (schedule) => schedule.day !== day || !schedule.range.includes(time)
        ),
      }));
    },
    [setSchedulesMap]
  );

  const handleDragEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tableId: string, event: any) => {
      const { active, delta } = event;
      const { x, y } = delta;
      const [, scheduleIndex] = active.id.split(":");
      const moveDayIndex = Math.floor(x / 80);
      const moveTimeIndex = Math.floor(y / 30);

      setSchedulesMap((prev) => {
        const schedule = prev[tableId][scheduleIndex];
        const nowDayIndex = DAY_LABELS.indexOf(
          schedule.day as (typeof DAY_LABELS)[number]
        );

        return {
          ...prev,
          [tableId]: prev[tableId].map((targetSchedule, targetIndex) => {
            if (targetIndex !== Number(scheduleIndex)) {
              return targetSchedule;
            }
            return {
              ...targetSchedule,
              day: DAY_LABELS[nowDayIndex + moveDayIndex],
              range: targetSchedule.range.map((time) => time + moveTimeIndex),
            };
          }),
        };
      });
    },
    [setSchedulesMap]
  );

  const handleCloseSearch = useCallback(() => {
    setSearchInfo(null);
  }, []);

  return (
    <>
      <Flex w="full" gap={6} p={6} flexWrap="wrap">
        {Object.entries(schedulesMap).map(([tableId, schedules], index) => (
          <ScheduleTableItem
            key={tableId}
            tableId={tableId}
            schedules={schedules}
            index={index}
            disabledRemoveButton={disabledRemoveButton}
            onOpenSearch={handleOpenSearch}
            onDuplicate={duplicate}
            onRemove={remove}
            onScheduleTimeClick={handleScheduleTimeClick}
            onDeleteSchedule={handleDeleteSchedule}
            onDragEnd={handleDragEnd}
          />
        ))}
      </Flex>
      <SearchDialog searchInfo={searchInfo} onClose={handleCloseSearch} />
    </>
  );
};
