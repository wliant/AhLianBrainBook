package com.wliant.brainbook.dto;

import java.util.List;

public record SearchResponse(
        List<SearchResultItem> results,
        long totalCount
) {
}
