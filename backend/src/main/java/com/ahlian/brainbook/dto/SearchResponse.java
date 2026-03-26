package com.ahlian.brainbook.dto;

import java.util.List;

public record SearchResponse(
        List<NeuronResponse> results,
        long totalCount
) {
}
