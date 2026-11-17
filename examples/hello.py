"""Offline code-reading example. Importing this file never executes it."""


class RunningMean:
    def __init__(self):
        self.total = 0.0
        self.count = 0

    def update(self, value):
        self.total += value
        self.count += 1
        return self.total / self.count


def demo():
    mean = RunningMean()
    return [mean.update(value) for value in (1, 2, 3, 4)]
