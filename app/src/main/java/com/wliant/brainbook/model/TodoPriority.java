package com.wliant.brainbook.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum TodoPriority {

    CRITICAL("critical"),
    IMPORTANT("important"),
    NORMAL("normal");

    private final String value;

    TodoPriority(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public int sortWeight() {
        return switch (this) {
            case CRITICAL -> 0;
            case IMPORTANT -> 1;
            case NORMAL -> 2;
        };
    }

    public static TodoPriority fromValue(String value) {
        if (value == null) return NORMAL;
        for (TodoPriority p : values()) {
            if (p.value.equals(value)) return p;
        }
        throw new IllegalArgumentException("Unknown todo priority: " + value);
    }

    @Converter(autoApply = false)
    public static class JpaConverter implements AttributeConverter<TodoPriority, String> {
        @Override
        public String convertToDatabaseColumn(TodoPriority priority) {
            return priority != null ? priority.getValue() : null;
        }

        @Override
        public TodoPriority convertToEntityAttribute(String value) {
            return value != null ? TodoPriority.fromValue(value) : null;
        }
    }
}
