// Offline code-reading example. This source is displayed, never compiled.
#include <numeric>
#include <vector>

double average(const std::vector<double>& values) {
    if (values.empty()) return 0.0;
    return std::accumulate(values.begin(), values.end(), 0.0) / values.size();
}
